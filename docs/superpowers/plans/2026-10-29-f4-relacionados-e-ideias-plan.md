# F4 (relacionados e ideias: "já recebo tráfego dele", título complementar, miniatura, aliases) Implementation Plan — r2.1

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development (ou executing-plans). Passos com checkbox (`- [ ]`).

## r2.1: achado → onde foi tratado

Re-revisões da r2: Phil `.superpowers/sdd/ab-lab/f4/phil-plano-r2.md` (82), Yannis `.../yannis-plano-r2.md` (86), ambas aprovadas com ressalvas. Nomes reconferidos em `origin/main` (`lerDetalheDiario`, `TETO_VIDEOS_CONSULTA`, `cancelReading`, `CancelSchema`, `HeldTask`, `heldObsTask`, `idx_yt_intel_obs_active` em `20261003000004:40`).

| Achado | Onde foi tratado |
|---|---|
| R2-P1 = R2-Y2 (`detail = ''` dentro de `.in(...)` não é seguro no PostgREST; a fake-sb não prova) | T2: `lerDetalheDiario` em `consultas.ts` ganha `semOrigem?: boolean` no filtro; com ele faz uma **segunda consulta** `.eq('source_type', ORIGEM_SUGERIDOS).eq('detail', '')` (select só `youtube_video_id, day_pt`); o `.in('detail', ...)` leva só ids reais e é pulado com lista vazia; teste de integração no 54421 (`HAS_LOCAL_DB`) com `'7'` de `detail=''` e outra do terceiro (voltam as duas) e caso com `terceirosYt = []` que ainda devolve a `''`; idas por abertura refeitas |
| R2-P4 + R2-Y5 + R2-Y6 (sentinela do `'32'`: sem índice, Sentry a cada abertura, consulta fora de `consultas.ts`) | T2: `contarOrigem(sb, siteId, canalIds, origem, de, ate)` dentro de `consultas.ts`, `count` com `head: true` por `channel_id in (canais do site)` + `day_pt` + `source_type` (usa o índice `(channel_id, day_pt, source_type)`); **sem Sentry na leitura**: só `contagens.f4_codigo_32` no retorno e o SQL T0(c) mensal no `ACOMPANHAMENTO.md`; `ler.ts` não consulta tabela direta (sai o "PONTO PARA PORTÃO" extra); tabela "falha em verde" |
| R2-Y1 (`cancelReading` apaga pendentes de outros vídeos do mesmo nicho) | T7: `CancelSchema`/`CancelInput` ganham `ownVideoId` e `signalId`, `.refine` do tipo novo os exige, `delete` filtra `target_own_video_id` e `target_signal_id`; `HeldTask` e as `cols` de `heldObsTask` leem as colunas novas; teste com dois pendentes |
| R2-Y3 (`create ... if not exists` não substitui o índice antigo) | T6: `drop index if exists idx_yt_intel_obs_active;` antes do `create`, na mesma migration; teste roda também após reaplicar |
| R2-P2 (índice único com `target_signal_id` anulável + `set null`) | T6: `target_signal_id` (fila) e `signal_id` (leituras) **sem FK** (referência mole: o sinal expira e some); o ramo do CHECK exige `target_signal_id is not null`; teste: sinal nulo falha no CHECK, apagar o sinal não falha nem altera a linha |
| R2-P3 (origem do `target_niche`; caminho de volta) | T6/T7: `target_niche` = nicho do canal do terceiro mais forte do sinal (`outlierMaisForte`), o ramo novo mantém `target_niche is not null`; teste do pedido sem nicho; rollback da migration apaga as linhas `titulo-complementar` (fila e leituras) **antes** de recriar os CHECKs antigos |
| R2-Y3 (resto) `competitor_readings` sem CHECK de tipo | T6: "CHECK de tipo se houver" vira "nenhum" (lido em `origin/main`); a ausência de FK em `signal_id` é deliberada (motivo escrito) |
| R2-P5 (`''` na janela bloqueia o "não") | Task M (ⓘ explica) e T5 D+7: taxa de pares `nao` possíveis por `select count(*) filter (where detail='') ... where source_type='7'` (T0(b)) |
| R2-P6 = R2-Y4 (repetição só contra o que cabe no teto de 5.000 caracteres) | T7: o `sent` leva também os **hashes normalizados de TODOS os títulos próprios** (O(T)) e `validarTitulosComplementares` compara contra eles; gatilho `titulos_enviados_n < total` no ledger |

---

## r2: achado → onde foi tratado

Revisões r1: Hanna `.superpowers/sdd/ab-lab/f4/hanna-plano-r1.md` (84), Phil `.../phil-plano-r1.md` (62), Yannis `.../yannis-plano-r1.md` (72). Nomes e arquivos reconferidos em `origin/main` (`TargetUnavailableError` em `forja/sent.ts:45`; `PASSO` privado em `ler-dimensoes.ts:178`, `passoDesligado` exportado de `coleta/passos-desligados`; `nomeDoLugar` em `_sugestoes/lugar.ts`; `PODE_IMPORTAR_CONSULTAS` em `test/youtube/observatorio/proprio-varredura.test.ts:95`).

| Achado | Onde foi tratado |
|---|---|
| P2 = Y2 (fila não comporta vídeo nosso × sinal; índice único por nicho) | T6 refeita: `target_own_video_id`, `target_signal_id` (fila), `own_video_id`, `signal_id` (leituras), `target_check` novo, índice único por vídeo × sinal, tipo excluído do `idx_yt_intel_obs_active`; teste no 54421. T7: `AskSchema.refine`, `readSent`/`completeReading`, regra de novidade, leitor por `own_video_id` |
| P1 (`'7'` com `detail` vazio ⇒ "não" falso) | T0(d) SQL; T1 motivo `origem_nao_informada` e entrada `diasSemOrigem`; T2 lê `details: [...terceirosYt, '']`; tabela "falha em verde"; T0(b) vira confirmação (limiar provado pela migration `20261013000006` e pela Q6) |
| P3 = Y8 (sentinela do `'32'` cega e passiva) | T2: contagem global de `'32'` por site e janela (`head: true`, sem filtro de `detail`), `Sentry.captureMessage` só com a contagem; T0(c) sem filtro; check mensal no `ACOMPANHAMENTO.md` |
| P4 = Y3a (200 títulos não cabem em `MAX_PROMPT`) | T7 teto por caracteres (~5.000 ≈ 80 títulos, mais recentes primeiro), `sent.titulos_enviados_n`; T8 teste "nenhum título do `sent` cortado por `_prioridades`"; T0(e) mede o comprimento |
| P5 (`nao_foi_possivel_conferir` perdido) | T2 recebe `AcessoPrivado`; motivo `nao_conferido`; teste com zero consultas |
| P6 = Y1 = H4 (Cowork sem caminho de prova) | D-F4-1 reescrita (padrão: `sem_direito` declarado no doc); T0 passo 2 vira confirmação; T2 callers do Cowork passam `null`; T3 teste de paridade reescrito (tela = pacote; rota = MCP = `sem_direito`); aceite da T5 |
| Y3b (números em títulos normais) | T7: números dos títulos enviados (dono e outliers) entram em `sent.numbers`; T8 mede a taxa de recusa no ensaio antes da T10 |
| Y3c (regra repetida à mão) | `fixtures_site/titulo-complementar-casos.json` lido por Vitest (T7) e por `teste_obs_pacotes.py` (T8) |
| Y4 (cobertura parada) | T1 `REGRA_F4.atrasoMaxDias = 4`, motivo `cobertura_velha` |
| Y5 (prova não confere o site) | T2 `provaValida(leitura, siteId)`; teste prova de A com site B |
| Y6 (`tsc` não cobre testes) | T2: `leitura` é o 6º parâmetro; `undefined` vale `sem_direito`; `grep` dos 3 callers com 6 argumentos; testes existentes ajustados |
| Y7 (varredura de importação) | T2: `ler.ts` entra em `PODE_IMPORTAR_CONSULTAS`, cabeçalho de `consultas.ts` atualizado, teste "`provaValida` antes de toda consulta" |
| Y9 = H8 (comandos da forja, `scp -r`) | T8 Step 4 reescrito pelo runbook §2 e §4 (portão `KIT-IGUAL` com a lista de commits, venv, `-w 1800`) e rollback com comando |
| Y10 (teto de 20 próprios) | T1/T2: `videos_total = proprios_agora_n`; lista truncada ⇒ `nao_medido: lista_truncada`; teste com 21 |
| Y11 (nomes) | T7: `TargetUnavailableError`; `passoDesligado` exportado (não o `PASSO`); `nomeDoLugar` e `outlierMaisForte` movidos para a lib; sinal lido no `readSent`; sinal fechado ⇒ outliers congelados no pedido |
| Y12 (rollback, `catch`) | T5 rollback = revert de T4, T3 e T2 juntos; T2 `catch` de tudo ⇒ `erro_de_leitura` |
| Y13 (corte do MCP) | T3 teste com 50 itens medindo bytes e outliers que sobram |
| Y14 (`bloco-sugestoes.tsx`) | T4 lista o arquivo e o teste dele |
| Y15 (teste que escreve um "não" falso) | T2 troca o teste por T0(d): SQL de `source_type` fora do formato numérico, check mensal; sem teste que afirme "não" para `'RELATED_VIDEO'` |
| P7 (dia do terceiro) | T1/T2: `published_at` → dia do Pacífico por `coleta/day-pt.ts`; teste de fronteira (23h30 BRT) |
| P8 (`views = 0`) | T1: `sim` com `views: 0`; M frase sem "0 visitas"; teste |
| P9 (origem própria) | T2 passo 3: todos os `youtube_videos` dos canais próprios do site; pares com terceiro de canal próprio descartados |
| P10 (T0(a) já respondida) | T0(a) vira confirmação por `select count(*)` (esperado 0) |
| Phil retenção do `sent` | Backlog (Fora deste plano) com gatilho |
| H1 (F4-3 espera F4-1 sem motivo) | Envios e calendário: B0 (migration) pode subir antes; T6–T8 em paralelo com T2/T3 e o mockup; D-F4-5 |
| H2 (dois mockups do mesmo cartão) | Task M única (linha + botão); M2 removida |
| H3 (`askReading` no Cowork é falso) | T9: Cowork só lê; D-F4-4; pedir pelo Cowork no backlog |
| H5 (aceite da T5 sem estado esperado) | T5: estado esperado de 29/10 escrito, falha se tudo `nao_medido` pelo mesmo motivo técnico |
| H6 (aceite da T10 aceita lista vazia) | T10: 1 a 5 títulos válidos ou recusa visível com motivo |
| H7 (F4-1 sozinha informa pouco) | Resolvido por H1/H2 (F4-3 colada) |

Estimativas refeitas: F4-1 ~465 mil, F4-3 ~510 mil (Yannis), total ~975 mil.

---

**Fonte:** spec `docs/superpowers/specs/2026-10-21-sugestoes-do-nicho-e-ab-nativo-design.md` (r17): linha F4 do §7 (~465), §4 itens 2 e 5 (~305–311), D18/D21 (~159–162), T2 item 7 (~235), B2 (~569), tabela de fontes (~295), risco `RELATED_VIDEO` (~478), ordem (~451). Abertura da Hanna `.superpowers/sdd/ab-lab/f4/hanna-abertura.md` (§5 aceite, §8 dado medido e decisões do dono). Dado: `.superpowers/sdd/ab-lab/f4/f4-dado-20261029-1658.txt`. **Base de código: `origin/main` `7ca820830` (29/10).** O checkout `staging` local (792 à frente, 1.721 atrás de `origin/main`) **não serve** para ler código: tudo abaixo foi lido com `git show origin/main:<arquivo>`; o executor trabalha numa worktree de `origin/main` (ou de `origin/staging`), nunca no checkout local.

**Goal:** mostrar em cada sugestão do nicho, na tela e no Cowork com o mesmo valor, se o vídeo do terceiro que puxa a sugestão já manda gente para os vídeos do dono (sim / não / não medido); depois, gerar pela forja até 5 títulos complementares por vídeo do dono; deixar planejadas, com gatilho medido, a análise da miniatura e a proposta de aliases.

**Arquitetura:** F4-1 é leitura pura: um núcleo sem banco (`trafego-terceiro/regra.ts`) decide o estado de cada par (vídeo nosso × vídeo do terceiro) a partir da cobertura `detalhe` e das linhas `source_type = '7'`; uma borda (`trafego-terceiro/ler.ts`) lê só esses dois fatos, reusando `proprio/consultas.ts` (`lerCobertura`, `lerDetalheDiario` com filtro), e `listarSinaisDoNicho` passa a exigir a prova de leitura privada (6º parâmetro) e devolve o campo em cada item, de modo que tela, rota, MCP e pacote `sugestoes` saem da mesma função; tela e pacote levam a prova do editor, rota e MCP (chave permanente) levam `null` e devolvem `sem_direito` (D-F4-1). Sem migration, sem coleta nova, sem forja. F4-3 é um tipo novo da fila da forja (`titulo-complementar`) com alvo próprio (vídeo nosso × sinal) em colunas novas, contexto congelado e validador de números, pedido pelo dono por botão na tela; o Cowork só lê. F4-2 e F4-4 ficam só planejadas.

**Tech Stack:** Next.js 16, TypeScript 5 strict, Supabase/PostgREST, Zod, Vitest; kit da forja em Python (`~/Workspace/forja/ferramentas`, git local); llama-server (Gemma 12B) na forja.

## Corte, do que entra ao que espera

| Parte | Tarefas | Sobe quando | O dono vê |
|---|---|---|---|
| **F4-1** "já recebo tráfego dele" | T0, T1, T2, T3, M, T4, T5 | mockup M (único) aprovado + revisão T5; **sem migration, sem flag** | uma linha no cartão da sugestão (hoje: "não" ou "não medido" em todos) e o mesmo estado no Cowork |
| **F4-3** título complementar | T6, T7, T8, M (único), T9, T10 | T6–T8 rodam em paralelo com T2/T3 e o mockup; migration → site → kit da forja (instalação é do dono) | botão "Pedir títulos" e a lista de até 5 títulos |
| **F4-2** miniatura (análise e ideias, só texto) | só planejada (§F4-2) | gatilho G2 medido | nada até o gatilho |
| **F4-4** aliases propostos e revisão | só planejada (§F4-4) | gatilho G4 medido | nada até o gatilho |
| "meu vídeo caiu" | **fora da F4 v1** (decisão do dono, 29/10) | volta com vídeo nosso ≥ 3 views/dia por 28 dias | nada |

### O fato que manda no corte (RELATED_VIDEO = 0 linhas) e a recomendação

Medido em 29/10 (§8 da Hanna): cobertura `detalhe` de 36 vídeos do tnFigueiredo de 08/09 a 27/10; `source_type = '7'` = **0 linhas em 90 dias**; outras origens têm linhas (4: 12, 5: 5, 0: 1, 8: 1), portanto a coleta está viva e a falta é de volume. Hoje a F4-1 diria "não" (ou "não medido") para todos.

- **F4-1 entra já.** O "não" honesto é informação (o vídeo do terceiro não manda ninguém, então a ação é título ou tema), custa ~455 mil tokens e não depende de dado novo. O mockup decide quanto destaque o "não" recebe, para não virar ruído repetido em todo cartão.
- **F4-3 não depende do "sim" nem da F4-1 no ar.** O spec (§4 item 5) não condiciona o título complementar ao `RELATED_VIDEO`; só a miniatura (§4 item 2, D18) é condicionada. Com "não", o spec manda a ação de título ou tema, ou seja, **a F4-3 é exatamente a ação do estado de hoje**. Recomendo executá-la colada na F4-1 (T6–T8 em paralelo; mockup único), ~510 mil tokens: sozinha, a F4-1 diz "não" em todo cartão e só a F4-3 dá o que fazer com ele (Hanna H1/H7). O brief a trata como condicionada; o plano corrige pelo texto do spec.
- **F4-2 só planejada, não codificada atrás de flag.** Diferente da T5 da F2b (estimador puro, testável com literais), a F4-2 depende de duas coisas que não existem: (a) um "sim" de terceiro monitorado e (b) **visão no modelo da forja, que hoje está desligada** (lido em 29/10 por `ssh forja`: `llama-server -m /srv/models/gemma-4-12b-it-Q5_K_M.gguf ... --jinja`, sem `--mmproj`; `/props` devolve `"modalities":{"vision":false}`; não há arquivo mmproj em `/srv/models/`; o prompt do worker diz "Você não vê imagens", `leituras_obs.py:277`). Codificar agora custaria ~200 mil tokens em código que não se prova de ponta a ponta (o prompt de imagem só se calibra com o modelo vendo imagem) e que apodrece até o gatilho. Esperar custa zero de valor, porque hoje não há par "sim" para analisar. **Recomendação: só planejar, com o gatilho G2.** A Hanna confirma ou corta no fecho do plano.
- **F4-4 só planejada**, gatilho G4 (contagem do Phil de outliers sem lugar depois de 2 a 3 semanas da F2).

---

## Global Constraints

- **Filtro pelo código, nunca pelo nome.** `RELATED_VIDEO` é `'7'` no lote (`reporting/codigos.ts:52`). Nova constante `ORIGEM_SUGERIDOS` em `codigos.ts`, derivada de `ORIGEM_LOTE` pelo nome (como `codigoDe('RELATED_VIDEO')` em `sinais/medida/regra-d2.ts:61`); nada de literal `'7'` nem `'RELATED_VIDEO'` em consulta. **Divergência com a Hanna §5** ("linha gravada como 'RELATED_VIDEO' também é lida"): o brief decidiu `source_type = '7'`, o normalizador grava o código como veio do lote, e o risco real é o `'32'` sem par (`codigos.ts:50`). O plano segue o brief e cobre o risco com a sentinela do `'32'` (T2).
- **"Não medido" ≠ "não".** Só a cobertura `detalhe` de `yt_own_video_coverage` (`metric_set = 'detalhe'`) separa os dois. A tabela `yt_own_video_traffic_detail_daily` é esparsa (CHECK `_esparsa`): sem linha = 0 views **ou** dia não coletado.
- **Privacidade e LGPD:** a F4-1 lê do detalhe só `source_type = ORIGEM_SUGERIDOS` e só os `detail` pedidos (ids de 11 caracteres de vídeos públicos de terceiros), nunca o texto de outra origem (termo de busca, URL). Nada de `detail` em log, erro ou Sentry (molde `ler-dimensoes.ts:8-9`). O dado é da Analytics do dono: a leitura exige `LeituraPrivadaDoSite` (`proprio/leitura-privada.ts`); sem prova válida **para o site**, `nao_medido` com motivo `sem_direito` (ou `nao_conferido`, se a guarda não conseguiu conferir), sem consultar nada. Só o caminho da chave por pessoa/editor lê; a chave permanente do Cowork não lê dado privado (P6, Y1).
- **Paridade Cowork/Claude Code (com a dívida declarada):** tela, rota `GET /api/pipeline/youtube/competitors/signals`, MCP `youtube_observatory.get_signals` e pacote `sugestoes` leem o campo da mesma `listarSinaisDoNicho`; nenhuma rota recalcula. Tela e pacote dão o estado real; rota e MCP (chave permanente, sem caminho de prova: `ServiceContext` não tem `userId`, `provarAcessoPrivadoDaChave` não tem chamador) dão `nao_medido: sem_direito`, dito no doc. Gatilho para pagar: ligar a porta do perfil no MCP (D-F4-1).
- **Escrita na forja é do dono:** o plano entrega comandos curtos, um por linha, para ele colar; agente só lê por `ssh forja '<leitura>'`. Toda mudança no kit termina em `git commit -- <caminhos>` em `~/Workspace/forja/ferramentas`.
- **Ordem forja (F4-3):** migration → site com o tipo novo no `OBS_TYPES` → kit instalado (comandos pelo runbook §2 e §4) → tipo anunciado no `TIPOS` do worker. Anunciar antes do site faz o `z.enum(OBS_TYPES)` do claim recusar o corpo e **parar a fila inteira**.
- **Migration** (T6) só por `npm run db:new <nome>`; idempotente (`drop constraint if exists` antes de `add`); `set lock_timeout = '5s'`; antes do YES do `db:push:prod`, `npx supabase migration list` com só ela pendente.
- **Mockup antes de tela:** Logan e Naksu discutem antes de desenhar (cada um com um opositor nas primeiras rodadas), a skill `frontend-design:frontend-design` desenha, os dois revisam, o dono aprova no Opera. Cor e símbolo estáveis por estado, inclusive "não medido"; método no ⓘ.
- Sem `any`; Zod em toda entrada externa; kebab-case. Subagentes: Sonnet `medium` executa; Opus `medium` só na 1ª revisão de Phil e Yannis. Pushes: só com build verificado; nunca stash/reset.

## Review Focus

1. **Dia sem cobertura dentro da janela** vira "não" por engano: o par só é `nao` com cobertura `detalhe` em pelo menos `REGRA_F4.diasMinimosCobertos` (7) dias de `[pub do terceiro, hoje]` **e** com o último dia coberto a no máximo `atrasoMaxDias` (4) de `hoje` (senão `cobertura_velha`, Y4); abaixo de 7, `pouca_cobertura`. Contagem por aritmética de intervalos. Teste na T1.
2. **Terceiro publicado depois do último dia coberto** (a cobertura vai até 27/10, o outlier saiu em 28/10): `nao_medido: ainda_nao_coletado`, nunca "não". Teste na T1.
3. **Origem própria** (`detail` = id de vídeo nosso, ou o "terceiro" é de um canal nosso): não conta como "sim" nem como par; teste na T1 e na T2.
4. **Código `'32'`** (`detalhe: 'nenhum'`, não carrega id de vídeo) passando a carregar o tráfego de sugeridos: o `'7'` esvazia sem erro. A sentinela conta **todas** as linhas `'32'` do site na janela, sem filtro de `detail` (P3), devolve `contagens.f4_codigo_32` e dispara `Sentry.captureMessage` com `> 0` (Y8); teste na T2.
5. **Sugeridos sem origem informada (P1):** linhas `'7'` com `detail = ''` (o YouTube omite abaixo do limiar) tornam o "não" impossível: sem linha do terceiro e com `'7'` sem origem na janela, o par é `nao_medido: origem_nao_informada`. Teste na T1 e na T2.
6. **Ids que não casam:** `proprios_agora` são `youtube_videos.id` (uuid) e `evidence.outliers[].video_id` é `competitor_videos.id` (uuid); o detalhe usa os ids do YouTube. Vídeo sem `youtube_video_id`, terceiro apagado de `competitor_videos`, mais de 50 vídeos (`TETO_VIDEOS_CONSULTA`): `nao_medido: sem_id` por par, e lotes de 50. Teste na T2.

## Falha em verde: o que cada leitura faz quando o dado não existe

| Leitura | Dado ausente | Comportamento |
|---|---|---|
| prova | `LeituraPrivadaDoSite` nula, `undefined`, forjada ou de outro site (`provaValida(leitura, siteId)`) | `nao_medido: sem_direito` em todos os itens, **zero consultas** |
| prova | `negativa: 'nao_foi_possivel_conferir'` (timeout da guarda) | `nao_medido: nao_conferido`, zero consultas (nunca `sem_direito`) |
| próprios | `proprios_agora === null` (site sem `video_lugares` próprio) | `nao_medido: sem_proprios_medidos` |
| próprios | `proprios_agora = []` | `nao_se_aplica` (não há vídeo nosso para receber tráfego; a linha não aparece) |
| próprios | `proprios_agora_n > proprios_agora.length` (teto de 20) | `nao_medido: lista_truncada`, nunca `nao`; `videos_total = proprios_agora_n` (Y10) |
| terceiro | sugestão sem outlier (`outlierMaisForte` nulo) | `nao_medido: sem_terceiro` |
| ids | uuid sem `youtube_video_id` / `competitor_videos.video_id` | par `nao_medido: sem_id` |
| tabela | `42P01` em `yt_own_video_coverage` ou no detalhe (`Leitura.ausente`) | `nao_medido: schema_ausente` em todos; o resto da lista segue |
| erro de banco / teto | qualquer exceção da borda (não só `ErroLeituraDimensoes`) | o campo vira `nao_medido: erro_de_leitura` (a lista não cai por causa da F4-1), um `Sentry.captureException` sem conteúdo (Y12) |
| passo desligado | `YT_OWN_STEPS_OFF` contém o passo do detalhe (`passoDesligado('normalizadores', env)`, o mapa `PASSO` é privado) | `nao_medido: coleta_desligada` |
| cobertura | vídeo sem intervalo `detalhe` | par `nao_medido: sem_cobertura` |
| cobertura | < 7 dias cobertos em `[pub, hoje]` | par `nao_medido: pouca_cobertura` |
| cobertura | último dia coberto < dia de publicação do terceiro | par `nao_medido: ainda_nao_coletado` |
| cobertura | `hoje − último dia coberto > 4` | par `nao_medido: cobertura_velha` (coleta parada), antes de qualquer `nao` |
| linha | sem linha do terceiro e com `'7'` de `detail = ''` na janela | par `nao_medido: origem_nao_informada` |
| linha | linha `'7'` com `views` nula ou `0` (com `watch_time > 0`) | conta como `sim` (a linha existe: houve tráfego), `views` nulo ou 0 como veio; a frase nunca diz "0 visitas" |
| linha | `detail` = id de vídeo nosso | ignorada (origem própria) |
| sentinela | qualquer linha `'32'` dos canais do site na janela | `contagens.f4_codigo_32 = n` (contagem por `channel_id in (...)`), sem mudar o estado e **sem Sentry na leitura** (R2-P4/Y5); o aviso é o SQL T0(c) mensal no `ACOMPANHAMENTO.md` |
| limiar | a Reporting omite a origem de linhas pequenas (`detail = ''`, provado pela migration `20261013000006` e pela Q6: 5 linhas `'5'`, 0 com detalhe) | tratado por `origem_nao_informada`; o texto do "não" diz "nenhuma visita informada pelo YouTube" e o ⓘ explica o limiar (frase do Logan, mockup) |

---

## Parte F4-1

### Task 0: Preparação (controlador, sem código)

- [ ] Ler em `origin/main`: `proprio/consultas.ts:67-160` (`AlvoConsulta`, `lerCobertura`, `lerDetalheDiario` com `filtro`; confirmar que `details` aceita `''`), `proprio/ler-dimensoes.ts:180-195,320-368` (`cobre`, `indexarCobertura`), `coleta/passos-desligados.ts`, `proprio/leitura-privada.ts` (`AcessoPrivado`, `negativa`), `sinais/leitura.ts:14-55,63,191-252` (`TETO_PROPRIOS_AGORA = 20`), `sinais/medida/series.ts:25,253-331`, `pipeline/services/niche-signals.ts`, `pipeline/mcp/services/youtube-observatory.ts:147-160`, `_sugestoes/{dados.ts,dados-da-tela.ts,view-model.ts,linha.tsx,lugar.ts}`, `_contexto-ia/sugestoes.ts` (`INVENTARIO_SUGESTOES`), `forja/{sent.ts,novidade.ts}`, `forja-queue.ts`. Divergência de assinatura → ledger antes de codar.
- [ ] **Prova no caminho do Cowork (confirmação, não descoberta):** Yannis e Phil já leram: `ServiceContext` não tem `userId` e `provarAcessoPrivadoDaChave`/`abrirPorta` não têm chamador em `apps/web/src`. Confirmar com `git grep` e registrar. Consequência já decidida (D-F4-1): rota e MCP passam `null`.
- [ ] **SQL de leitura (dono ou controlador, `supabase db query --linked`), resultado no ledger** `.superpowers/sdd/ab-lab/f4/ledger.md`:
  - (a) confirmação: `select count(*) from youtube_videos v join youtube_channels c on c.id = v.channel_id where c.name = 'Thiago Figueiredo';` (esperado 0; o código já mostra que `yt_own_traffic_detail_apply` aceita `baixado` e `vazio` e estende a cobertura, P10).
  - (b) limiar: `select count(*) filter (where detail = '') as sem_origem, count(*) as total from yt_own_video_traffic_detail_daily where source_type = '7';` (P1).
  - (c) `'32'` total, **sem filtro de `detail`**: `select source_type, count(*) from yt_own_video_traffic_detail_daily where source_type in ('7','32') group by 1;` (esperado 0 para o `'32'`).
  - (d) formato do código: `select distinct source_type from yt_own_video_traffic_detail_daily where source_type !~ '^[0-9]+$';` (esperado vazio; cobre o `'RELATED_VIDEO'` literal, Y15). Entra mensal no `ACOMPANHAMENTO.md` junto com (c).
  - (e) comprimento dos títulos: `select count(*), round(avg(char_length(title))), max(char_length(title)) from youtube_videos;` (P4; define o teto da T7).
- [ ] `pg_get_constraintdef` de `youtube_intelligence_tasks_target_check`, `_task_type_check` e do índice `idx_yt_intel_obs_active` em produção, para a T6.
- [ ] Pedir a estimativa do Phil para o gatilho G4 (outliers sem lugar) com data: 2 a 3 semanas da F2 (F2 ligada 28/10 ⇒ ~12/11 a ~19/11), lembrete no `ACOMPANHAMENTO.md`. D0/D+7 da F4-1 (Phil §5) também vão para o `ACOMPANHAMENTO.md`: `max(covered_to) >= current_date - 3` em D+7.

**Aceite:** ledger com (a)–(e), os `pg_get_*` e a confirmação da prova. Estimativa: ~25 mil tokens.

### Task 1: Núcleo puro — estado do par e da sugestão

**Files:**
- Modify: `apps/web/src/lib/youtube/reporting/codigos.ts` (exporta `ORIGEM_SUGERIDOS`, `ORIGEM_SUGERIDOS_SEM_PAR = '32'`)
- Create: `apps/web/src/lib/youtube/observatorio/sinais/trafego-terceiro/regra.ts`
- Test: `apps/web/test/youtube/observatorio/sinais/trafego-terceiro/regra.test.ts`

**Interfaces (Produces):**
- `ORIGEM_SUGERIDOS: string` = a chave de `ORIGEM_LOTE` cujo `nome === 'RELATED_VIDEO'` (lança no import se não houver exatamente uma).
- `REGRA_F4 = { versao: 1, diasMinimosCobertos: 7, atrasoMaxDias: 4, janelaMaxDias: 90 } as const` (90 = janela da Q3; o terceiro de um sinal tem no máximo `REGRA_SINAIS.janelaDias` (14) de idade mais a vida do sinal, então 90 sobra).
- `type MotivoNaoMedido = 'sem_direito' | 'nao_conferido' | 'sem_proprios_medidos' | 'lista_truncada' | 'sem_terceiro' | 'sem_id' | 'schema_ausente' | 'erro_de_leitura' | 'coleta_desligada' | 'sem_cobertura' | 'pouca_cobertura' | 'cobertura_velha' | 'ainda_nao_coletado' | 'origem_nao_informada'`
- `type EstadoDoPar = { estado: 'sim'; views: number | null; dias: number } | { estado: 'nao'; diasCobertos: number; ate: string } | { estado: 'nao_medido'; motivo: MotivoNaoMedido }`
- `estadoDoPar(p: { pubDoTerceiro: string /* dia PT, de coleta/day-pt.ts */; hoje: string; intervalos: ReadonlyArray<{ de: string; ate: string }>; linhas: ReadonlyArray<{ dia: string; views: number | null }>; diasSemOrigem: ReadonlyArray<string> /* dias com '7' de detail vazio, do vídeo nosso */ }): EstadoDoPar` — janela `[max(pubDoTerceiro, hoje − 90), hoje]`; só linhas dentro da janela contam; dias cobertos = interseção dos intervalos com a janela por **aritmética de intervalos** (sem laço dia a dia); ordem de decisão: `sim` se houver linha do terceiro (com ou sem `views`); senão `sem_cobertura` (sem intervalos); `ainda_nao_coletado` (maior `ate` < `pubDoTerceiro`); `cobertura_velha` (`hoje − maior ate > atrasoMaxDias`); `pouca_cobertura` (< 7 dias cobertos); `origem_nao_informada` (≥ 1 dia de `diasSemOrigem` na janela); `nao` (`ate` = último dia coberto).
- `type TrafegoDoTerceiro = { estado: 'sim' | 'nao' | 'nao_medido' | 'nao_se_aplica'; motivo: MotivoNaoMedido | null; terceiro_video_id: string | null; videos_com_trafego: number; videos_medidos: number; videos_total: number; views: number | null; ate: string | null; regra: 'f4-trafego-v1' }`
- `estadoDaSugestao(pares: ReadonlyArray<EstadoDoPar>, terceiroId: string | null, motivoGeral: MotivoNaoMedido | null, totalProprios: number, truncada: boolean): TrafegoDoTerceiro` — `sim` se ≥ 1 par `sim`; `nao` se todos os pares forem `nao` (≥ 1 par) **e** `!truncada`; `truncada` sem `sim` ⇒ `nao_medido: lista_truncada` (Y10); senão `nao_medido` com o motivo mais frequente entre os pares (desempate pela ordem do tipo); `pares = []` sem motivo geral ⇒ `nao_se_aplica`; `videos_total = totalProprios`; `views` = soma dos `sim` (nulo se algum `sim` tiver `views` nulo); `ate` = o menor `ate` entre os `nao` medidos.

- [ ] **Step 1: testes com literais (FAIL):** `ORIGEM_SUGERIDOS === '7'` e `ORIGEM_LOTE[ORIGEM_SUGERIDOS].nome === 'RELATED_VIDEO'`; coberto 08/09–27/10, hoje 29/10, pub 01/10, linha em 05/10 → `sim`; mesmo sem linha → `nao` com `diasCobertos = 27`, `ate = '2026-10-27'`; sem intervalos → `sem_cobertura`; cobertura até 27/10 e pub 28/10 → `ainda_nao_coletado` (Review Focus 2); pub 22/10, cobertura até 27/10 (6 dias) → `pouca_cobertura` (Review Focus 1); cobertura até `hoje − 10`, pub `hoje − 40` → `cobertura_velha`; até `hoje − 2` → `nao` (Y4); sem linha do terceiro e `diasSemOrigem = ['2026-10-10']` → `origem_nao_informada` (P1); mesmo dia com linha do terceiro → `sim`; buraco 10/10–20/10 numa cobertura que ainda soma ≥ 7 → `nao`; linha de 30/09 com pub 01/10 é ignorada; linha com `views: null` → `sim` com `views: null`; linha com `views: 0` → `sim` com `views: 0` (P8); fronteira do dia: terceiro publicado às 23h30 BRT convertido para dia PT por `day-pt.ts` (teste de `pubDoTerceiro` no helper da T2, P7); sugestão com 3 pares (`sim`, `nao`, `nao_medido`) → `sim`, `videos_com_trafego = 1`, `videos_medidos = 2`, `videos_total = 3`; (`nao`, `nao_medido`) → `nao_medido`; (`nao`, `nao`) → `nao`; (`nao`, `nao`) com `truncada` e `totalProprios = 21` → `nao_medido: lista_truncada`; `[]` → `nao_se_aplica`; motivo geral `sem_direito` vence os pares.
- [ ] **Step 2:** rodar `npx vitest run test/youtube/observatorio/sinais/trafego-terceiro` → FAIL (módulo inexistente).
- [ ] **Step 3:** implementar `regra.ts` (importa `addDays`, `diffDias` de `coleta/day-pt.ts`; nenhum banco, nenhum relógio).
- [ ] **Step 4:** PASS. **Step 5:** commit `feat(f4): estado do tráfego vindo do vídeo do terceiro (núcleo puro)`.

**Aceite:** teste verde; nenhum literal `'7'`/`'RELATED_VIDEO'` fora de `codigos.ts` no diretório novo (`grep`). Estimativa: ~50 mil tokens.

### Task 2: Borda — leitura da cobertura e das linhas `'7'`, no `listarSinaisDoNicho`

**Files:**
- Create: `apps/web/src/lib/youtube/observatorio/sinais/trafego-terceiro/ler.ts`
- Modify: `apps/web/src/lib/youtube/observatorio/sinais/leitura.ts` (`ItemDeSinal.trafego_do_terceiro`, novo 6º parâmetro)
- Modify: `apps/web/src/lib/youtube/observatorio/proprio/consultas.ts` (cabeçalho, linhas 1–5: lista de quem importa; `lerDetalheDiario` ganha `semOrigem?: boolean` no `filtro`; função nova `contarOrigem(sb, siteId, canalIds, origem, de, ate): Promise<Leitura<number>>`, R2-P1/P4/Y6) e `apps/web/test/youtube/observatorio/proprio-varredura.test.ts` (`PODE_IMPORTAR_CONSULTAS` ganha `lib/youtube/observatorio/sinais/trafego-terceiro/ler.ts`, comentário "PONTO PARA PORTÃO": chama só `lerDetalheDiario`/`contarOrigem` com `ORIGEM_SUGERIDOS`/`'32'`, atrás de `provaValida`; `ler.ts` não faz `.from(...)` direto) (Y7)
- Move: `outlierMaisForte` (de `_sugestoes/view-model.ts:82`) e `nomeDoLugar` (de `_sugestoes/lugar.ts`) para `lib/youtube/observatorio/sinais/` (a lib não importa da pasta da tela); o view-model e `lugar.ts` reexportam (Y11)
- Modify (callers): `_sugestoes/dados.ts`, `_sugestoes/dados-da-tela.ts` (passam `await leituraDoEditor(siteId)`, guarda de edição já passada), `pipeline/services/niche-signals.ts` e o `get_signals` do MCP (passam `null`, D-F4-1)
- Test: `apps/web/test/youtube/observatorio/sinais/trafego-terceiro/ler.test.ts` (sobre `test/youtube/observatorio/sinais/fake-sb.ts`), `apps/web/test/integration/f4-detalhe-vazio.test.ts` (`describe.skipIf(skipIfNoLocalDb())`, banco 54421, passa pelo PostgREST real, R2-P1), ajuste de `test/youtube/observatorio/sinais/leitura.test.ts` (as chamadas em `:94,418` passam `calculoLigado` explícito e a prova)

**Interfaces:**
- Consumes: `estadoDoPar`, `estadoDaSugestao`, `ORIGEM_SUGERIDOS`, `ORIGEM_SUGERIDOS_SEM_PAR` (T1); `lerCobertura`, `lerDetalheDiario`, `TETO_VIDEOS_CONSULTA`, `AlvoConsulta` (`proprio/consultas.ts`); `AcessoPrivado`/`leituraValida` (`proprio/leitura-privada.ts`); `passoDesligado` (`coleta/passos-desligados`).
- Produces: `provaValida(acesso: AcessoPrivado | LeituraPrivadaDoSite | null | undefined, siteId: string)` (molde `lista-borda.ts:246`: brand check **e** `leitura.siteId === siteId`, Y5), devolvendo `{ ok: true; leitura } | { ok: false; motivo: 'sem_direito' | 'nao_conferido' }` (P5).
- Produces: `lerTrafegoDoTerceiro(sb: SupabaseClient, siteId: string, acesso: AcessoPrivado | LeituraPrivadaDoSite | null | undefined, itens: ReadonlyArray<Pick<ItemDeSinal, 'id' | 'evidence' | 'proprios_agora' | 'proprios_agora_n'>>, hoje: string, env?: NodeJS.ProcessEnv): Promise<{ porItem: Map<string, TrafegoDoTerceiro>; codigo32: number }>`
- Produces: `listarSinaisDoNicho(sb, siteId, agora, limite, calculoLigado, leitura: AcessoPrivado | LeituraPrivadaDoSite | null)` — `leitura` é o **6º** parâmetro, obrigatório no tipo; em execução `undefined` vale `sem_direito` com zero consultas (Y6: o `tsc` não cobre `test/**`, então um parâmetro novo na 5ª posição desloca em silêncio as chamadas dos testes); `ItemDeSinal.trafego_do_terceiro: TrafegoDoTerceiro` (obrigatório); `contagens.f4_codigo_32` só quando medido.

Algoritmo (o que a assinatura não decide): (1) `provaValida(acesso, siteId)`; falhou ⇒ todos `sem_direito`/`nao_conferido`, zero consultas; (2) dos itens, os pares `(proprio, terceiro = outlierMaisForte)`; itens com `proprios_agora_n > proprios_agora.length` marcam `truncada`; (3) uma ida a `youtube_videos` (`id, youtube_video_id` dos uuids do site) e uma a `competitor_videos` (`id, video_id, published_at, channel` dos uuids dos terceiros); o conjunto de **origem própria** é **todo** `youtube_videos` dos canais próprios do site (não só os de `proprios_agora`, P9), e pares cujo terceiro é de canal próprio (`competitor_channels` marcado `own`) são descartados antes da consulta; `published_at` vira dia do Pacífico por `coleta/day-pt.ts` (P7); (4) por bloco de `TETO_VIDEOS_CONSULTA` ytIds nossos, `lerCobertura(sb, alvo, ['detalhe'])` e duas consultas por bloco: `lerDetalheDiario(sb, alvo, { sourceType: ORIGEM_SUGERIDOS, details: terceirosYt })` (só ids reais; **pulada** se `terceirosYt` for vazio) e `lerDetalheDiario(sb, alvo, { sourceType: ORIGEM_SUGERIDOS, details: [], semOrigem: true })`, que faz `.eq('detail', '')` e seleciona só `youtube_video_id, day_pt`; **nunca** `''` dentro de `.in(...)` (o `postgrest-js` monta `in.(a,)` e o PostgREST pode descartar o vazio: R2-P1/Y2); `canalId: null` e janela `[min(pub) dos terceiros, hoje]` cortada em 90 dias; as linhas da 2ª consulta viram `diasSemOrigem` (P1; `detail` vazio nunca é gravado nem logado como id); indexação por `Map` de `(ytNosso, detail)`, proibido `find`/`filter` por par (O(P·L)); blocos em `Promise.all`; (5) a sentinela é **`contarOrigem(sb, siteId, canalIds, ORIGEM_SUGERIDOS_SEM_PAR, de, ate)`** em `consultas.ts` (`count` com `head: true`, sem filtro de `detail`, P3), por `channel_id in (canais do site)` + `day_pt` + `source_type`, que usa o índice `(channel_id, day_pt, source_type)` e evita varrer a tabela por `site_id` (R2-P4); o resultado vai a `contagens.f4_codigo_32` e **não há `Sentry.captureMessage` na leitura** (um evento por abertura da tela gastaria a cota e o dono aprenderia a ignorar; R2-P4/Y5): o aviso é o SQL T0(c) mensal no `ACOMPANHAMENTO.md`; (6) `passoDesligado('normalizadores', env)` ⇒ `coleta_desligada`; (7) `try/catch` de **toda** exceção da borda ⇒ `erro_de_leitura` (a lista não cai, Y12). Complexidade: O(P + L + C); idas ao banco = 2 + 2·⌈V/50⌉ (cobertura + `'7'` com ids) + ⌈V/50⌉ (`'7'` de `detail` vazio) + 1 (contagem do `'32'`) (V = vídeos nossos distintos nos itens; hoje V ≤ 36 ⇒ 6 idas; V = 110 ⇒ 12), dentro do tempo de função.

- [ ] **Step 1: testes (FAIL)** no fake-sb: sem prova → `sem_direito` e o fake registra **0** chamadas; `undefined` idem; prova de A com `siteId` B → `sem_direito` e 0 chamadas (Y5); `negativa: 'nao_foi_possivel_conferir'` → `nao_conferido`, 0 chamadas (P5); `ler.ts` chama `provaValida` antes de qualquer `lerCobertura`/`lerDetalheDiario` (Y7); prova válida, cobertura e linha `'7'` com `detail` = yt do terceiro → `sim`; linha `'7'` com `detail = ''` e sem linha do terceiro → `origem_nao_informada` (P1); linha `'7'` com `detail` = yt de um vídeo nosso (ou de qualquer `youtube_videos` dos canais próprios) → não conta; linha `'32'` em qualquer `detail` → estado inalterado, `codigo32 = 1`, **nenhuma chamada ao Sentry** (spy); `0` → `codigo32 = 0`; a contagem filtra por `channel_id in (...)` (o fake registra o filtro); `terceirosYt = []` → só a consulta `semOrigem` roda; `''` nunca aparece dentro de um `in` (o fake falha se vir `''` num `in`); **teste de integração no 54421** (`f4-detalhe-vazio.test.ts`, passa pelo PostgREST real): uma linha `'7'` com `detail=''` e outra com id do terceiro, `lerDetalheDiario` com `details: [id]` devolve a do terceiro, com `semOrigem: true` devolve a `''`; com `details: []` a `''` ainda volta (R2-P1); 51 vídeos nossos → 2 blocos; 21 próprios (`proprios_agora_n = 21`, lista de 20) → `lista_truncada` (Y10); terceiro sem `competitor_videos` → par `sem_id`; terceiro de canal próprio descartado; `Leitura.ausente` na cobertura → `schema_ausente` em todos e a lista **continua** com os outros campos; qualquer exceção (`TypeError` incluso) → `erro_de_leitura`, lista intacta; teste que **apaga** `YT_OWN_STEPS_OFF` (`delete process.env.YT_OWN_STEPS_OFF`) e afirma que o passo conta como ligado; teste que **apaga a cobertura** de um par com linha ausente e afirma `nao_medido`, nunca `nao` (Hanna §5). Sem teste que afirme "não" para um `source_type` literal `'RELATED_VIDEO'` (Y15: coberto pelo T0(d) mensal).
- [ ] **Step 2:** FAIL. **Step 3:** implementar `ler.ts` e plugar no fim de `listarSinaisDoNicho` (depois de montar `itens`; com `n === 0` não lê nada).
- [ ] **Step 4:** PASS, mais `npx vitest run test/youtube/observatorio test/cms/youtube/sugestoes-*` (a varredura de importação inclusive) sem regressão; typecheck web. **Step 5:** commit.

**Aceite:** testes verdes (inclusive o de integração no 54421, R2-P1); `grep -rn "from('yt_own_video_traffic_detail_daily')" apps/web/src/lib/youtube/observatorio/sinais` vazio (a consulta mora em `consultas.ts`); `grep -rn "source_type.*RELATED_VIDEO\|'7'" apps/web/src/lib/youtube/observatorio/sinais/trafego-terceiro` vazio; `grep -rn "listarSinaisDoNicho(" apps/web/src` mostra 3 callers (tela, `dados.ts`, `niche-signals.ts`), todos com 6 argumentos. Estimativa: ~85 mil tokens.

### Task 3: Cowork — rota, MCP, pacote `sugestoes` e docs (paridade declarada)

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_contexto-ia/sugestoes.ts` (`INVENTARIO_SUGESTOES` ganha `itens[].trafego_do_terceiro.*`: `estado`/`motivo`/`regra` como `'rotulo'`, contagens e `views` como `'numero'`, `terceiro_video_id` como `ID`, `ate` como `'base'`; célula na tabela do pacote com estado `nao_medido` e motivo quando for o caso). No pacote só `estado`, `motivo` e contagens de vídeos; `views` só com prova (já é assim) e nunca no `sent` da forja (P6)
- Modify: `apps/web/data/pipeline-docs/cowork-docs-youtube.md` (seção do `GET /competitors/signals`: campo novo, os estados, "não medido não é não", **a rota e o `get_signals` devolvem `nao_medido`/`sem_direito` até a porta do perfil ligar no MCP**), `docs/cowork-pipeline-reference.md` (schema da resposta) e reseed (`reference_cowork_pipeline_schemas`: rodar o script de seed depois de editar)
- Test: `apps/web/test/cms/youtube/sugestoes-paridade-f4.test.ts`

**Interfaces:** Consumes `ItemDeSinal.trafego_do_terceiro` (T2). Nenhuma rota nova (Pipeline Integrity: `api-registry.ts` intacto, só o doc).

- [ ] **Step 1: teste (FAIL), reescrito pela D-F4-1:** para a mesma `ListaDeSinais` com três itens: (i) tela (`dados-da-tela`) e pacote (`modeloDeSugestoes` + `empacotarSugestoes`) devolvem o **mesmo** `estado`, `motivo`, números e `ate` por `id`; (ii) `listNicheSignals` (via fake) e o `get_signals` do MCP devolvem `nao_medido`/`sem_direito` para os mesmos ids; (iii) os demais campos do item são iguais nos quatro caminhos; (iv) o teste do inventário (toda folha listada) cobre o campo novo; (v) com 50 itens no pior caso, o MCP mede os bytes do campo novo (~250 B × 50) e afirma quantos outliers sobram no corte de 60.000; ele **não** corta `trafego_do_terceiro` (Y13).
- [ ] **Step 2–4:** implementar, PASS, typecheck. Docs e reseed. **Step 5:** commit.

**Aceite:** paridade (i)–(v) verde; doc e reference atualizados e reseed rodado (saída no ledger). Estimativa: ~65 mil tokens.

### Task M: Mockup único do cartão (linha "já recebo tráfego" + botão de títulos)

Um rito só (D-F4-5, H2): o dono aprova a linha vendo para onde ela leva. Pasta `docs/superpowers/mockups/2026-10-29-f4-trafego-e-titulos/`. Decide: (1) onde a linha entra no cartão (`linha.tsx`, perto de `seus`) e se o "não" aparece com destaque ou só no ⓘ, de modo a não virar ruído repetido em ~todo cartão; (2) texto exato dos estados e do parcial ("medido em 2 de 3 vídeos seus"), incluindo `origem_nao_informada` ("nenhuma visita informada pelo YouTube", com o limiar no ⓘ), `cobertura_velha`, `nao_conferido`, `lista_truncada`, e `sem_direito` do Cowork (só doc); nenhuma frase diz "0 visitas"; (3) cor e símbolo por estado (inclusive "não medido", em hex/rgba literal, nunca `color-mix`); (4) o ⓘ (janela desde a publicação do terceiro, "até dd/mm", regra `f4-trafego-v1`; **e a frase do R2-P5**: se o YouTube informou qualquer visita sem origem identificada na janela, o "não" não é afirmado, por isso o "não" é raro); (5) onde fica o botão "Pedir títulos" (cartão aberto, por vídeo nosso; ou ficha do vídeo), os estados (forja sem a capacidade, na fila, gerando, pronto, recusado pelo validador **com o motivo**, forja parada), a lista de até 5 com "copiar", o aviso "ideias, não cópia" e o que acontece com 0 títulos válidos; (6) 1440 e 390 px; (7) o mesmo no bloco de sugestões do A/B Lab (`ab-lab/_components/bloco-sugestoes.tsx`).

- [ ] Logan (`logan-ux`) e Naksu (`naksu-ui`) discutem o plano da tela, cada um com um opositor na 1ª rodada; acordo escrito em `NOTAS.md` na pasta.
- [ ] A skill `frontend-design:frontend-design` desenha `index.html` com os estados da linha e os do botão no mesmo cartão, em dado de semente realista (36 vídeos, todos "não", e um "sim" fictício marcado como exemplo).
- [ ] Logan e Naksu revisam até concordar; o dono vê no Opera (`open -a Opera <arquivo>`) e aprova; entrada no `ROTEIRO-DE-TESTE-E-MELHORIAS.md`.

**Aceite:** "pode" do dono registrado, dizendo que libera a T4 e a T9. Roda em paralelo com T2/T3 e T6–T8. Estimativa: ~130 mil tokens (65 do cartão/linha na F4-1, 65 do botão na F4-3).

### Task 4: Tela — a linha no cartão

**Files:**
- Modify: `apps/web/src/app/cms/(authed)/youtube/competitors/_sugestoes/view-model.ts` (`LinhaDaVista.trafego: { estado: 'sim' | 'nao' | 'nao_medido'; texto: string; info: string } | null`; `null` só para `nao_se_aplica`), `.../_sugestoes/linha.tsx`, `.../_sugestoes/sugestoes.css`, `.../_sugestoes/frases.ts` ou `sinais/frases.ts` (textos do mockup, exatos), `apps/web/src/app/cms/(authed)/youtube/ab-lab/_components/bloco-sugestoes.tsx` (Y14)
- Test: `apps/web/test/cms/youtube/sugestoes-view-model.test.ts`, `apps/web/test/cms/youtube/sugestoes-lista.test.tsx` (`// @vitest-environment jsdom`) e o teste existente do `bloco-sugestoes` (criar se não houver)

- [ ] **Step 1 (FAIL):** `montarLinha` com cada estado devolve o texto do mockup; `nao_medido` **nunca** renderiza "0" nem "não" (assert sobre o HTML); `nao_se_aplica` não renderiza a linha; o parcial mostra "x de y"; `views: 0` não vira "0 visitas"; o `bloco-sugestoes` do A/B Lab mostra a mesma linha.
- [ ] **Step 2–4:** implementar, PASS; `next build` local não é obrigatório (Vercel faz), typecheck sim.
- [ ] **Step 5 (Gio, `gio-qa`, Sonnet):** semente com um cartão por estado; Opera/Playwright a 1440 e 390 px; capturas em `docs/superpowers/mockups/2026-10-29-f4-trafego-e-titulos/shots/`; veredito em texto ao ledger.
- [ ] **Step 6:** commit.

**Aceite:** testes verdes; Gio aprova os estados nos dois tamanhos. Estimativa: ~85 mil tokens.

### Task 5: Revisão da F4-1 e envio

- [ ] Phil (`phil-dados`) e Yannis (`yannis-software`), Opus `medium`, sobre o diff T1–T4; consertos por executor Sonnet; re-revisão escopada em Sonnet até acordo.
- [ ] Envio A: push de staging com build verificado, promoção no próximo push combinado do dia. Sem migration e sem flag. **Rollback = `git revert` de T4, T3 e T2 juntos** (T3 e T4 leem `trafego_do_terceiro`; reverter só a T2 não compila, Y12); a T1 é inofensiva sozinha.
- [ ] **Conferência D0 (controlador, depois confirmada pelo dono), estado esperado com o dado de 29/10 (`'7'` = 0 linhas, cobertura `detalhe` até 27/10):** na aba Sugestões com dado de produção, todo cartão com terceiro mostra "não" com "até dd/mm" (último dia coberto, 27/10 ou depois) ou um `nao_medido` com motivo legível; **nenhum** cartão mostra "0"; o pacote `sugestoes` devolve o **mesmo** `estado` e o mesmo `ate` por `id`; o `get_signals` no Cowork devolve `nao_medido: sem_direito` (D-F4-1, declarado no doc); nenhum item de tela/pacote vem com `sem_direito`; `contagens.f4_codigo_32` ausente ou 0. Se todos os itens de tela vierem `nao_medido` com o mesmo motivo técnico (`schema_ausente`, `erro_de_leitura`, `coleta_desligada`, `cobertura_velha`), o envio **não** está pronto. Os selects de T0(b)–(d) rodam no D0 e vão ao ledger. **D+7 (R2-P5):** a taxa de `''` do T0(b) (`count(*) filter (where detail='')` sobre o total de `'7'`) mede quantos pares `nao` ainda são possíveis, porque qualquer dia `''` na janela de um vídeo nosso bloqueia o "não" desse par; vai ao `ACOMPANHAMENTO.md`.

**Aceite:** pareceres no ledger; conferência D0 acima. Estimativa: ~90 mil tokens.

---

## Parte F4-3 (título complementar pela forja)

T6, T7 e T8 não têm tela e não dependem da F4-1: rodam em paralelo com T2/T3 e com o mockup (executores separados; conflito de arquivo conferido: T2/T3 tocam `sinais/`, `_sugestoes/`, `pipeline/services/niche-signals.ts`; T6–T8 tocam `forja/`, `forja-queue.ts`, `load.ts`, migration e kit; sem interseção, exceto `_sugestoes/lugar.ts` que a T7 só **importa** depois da T2 movê-lo).

### Task 6: Migration — tipo novo da fila e alvo "vídeo nosso × sinal"

**Files:** `npm run db:new f4_forja_titulo_complementar` → `supabase/migrations/<ts>_f4_forja_titulo_complementar.sql`; teste em `apps/web/test/integration/f4-forja-tipo.test.ts` (`describe.skipIf(skipIfNoLocalDb())`, banco de integração 54421).

- [ ] Antes: `pg_get_constraintdef` (T0) para conferir os nomes e as listas atuais em produção (podem ter mudado depois de 03/10).
- [ ] `set lock_timeout = '5s'`; tudo idempotente. Em `youtube_intelligence_tasks`: `add column if not exists target_own_video_id uuid references youtube_videos(id) on delete cascade` e `target_signal_id uuid` **sem FK** (R2-P2: em índice único o NULL é distinto, e `on delete set null` transformaria um pedido aberto em par sem sinal; o sinal expira e some, a referência é mole); recriar o CHECK de `task_type` (hoje `20261003000004_observatorio_forja.sql:26`; `drop constraint if exists` + `add`, os 6 de hoje + `'titulo-complementar'`); recriar `youtube_intelligence_tasks_target_check` (hoje `20261003000006:123-126`) com o ramo `task_type = 'titulo-complementar' ⇒ target_own_video_id is not null and target_signal_id is not null and target_video_id is null` (e `target_niche is not null`, que o ramo `<> 'diagnostico'` já exige: R2-P3/Y3; **origem do `target_niche`**: o nicho do canal do terceiro mais forte do sinal, mesma regra do `outlierMaisForte`, gravado pela T7; sem ele a quota e o `planAsk` por nicho juntariam pedidos de vídeos diferentes) e mantendo `(task_type = 'leitura-video') = (target_video_id is not null)` para os demais; recriar `idx_yt_intel_obs_active` com **`drop index if exists idx_yt_intel_obs_active;` antes do `create unique index`** (hoje é `create unique index if not exists` com o mesmo nome em `20261003000004:40`: sem o `drop` o índice antigo, sem o `not in`, permanece e o 2º vídeo do nicho dá 23505; R2-Y3) e `and task_type not in ('diagnostico','titulo-complementar')`, e criar `idx_yt_intel_titulo_active` único parcial em `(site_id, task_type, target_own_video_id, target_signal_id) where status in ('pending','running') and task_type = 'titulo-complementar'`.
- [ ] Em `competitor_readings`: `own_video_id uuid references youtube_videos(id) on delete cascade` e `signal_id uuid` (sem FK, de propósito: o sinal expira e a leitura gravada deve sobreviver a ele; R2-P2), nenhum CHECK de tipo (`competitor_readings` não tem; lido em `origin/main`), índice `(site_id, task_type, own_video_id, generated_at desc) where own_video_id is not null`.
- [ ] Teste no 54421: dois `titulo-complementar` pending para vídeos nossos diferentes do mesmo nicho passam; o mesmo vídeo × sinal duas vezes dá 23505; um com `target_video_id` preenchido falha no CHECK; um com `'xyz'` falha; um com `target_signal_id` nulo falha no CHECK (R2-P2); um sem `target_niche` falha (R2-P3); apagar o `niche_signals` referenciado não falha nem altera a linha (sem FK); reaplicar a migration não falha **e o teste de "dois vídeos diferentes passam" roda também depois da reaplicação** (R2-Y3).
- [ ] **Caminho de volta (R2-P3), em comentário no fim da migration e testado:** `delete from youtube_intelligence_tasks where task_type = 'titulo-complementar'` e `delete from competitor_readings where task_type = 'titulo-complementar'` **antes** de recriar os CHECKs e o índice antigos, senão o rollback falha por linha que viola o CHECK velho; depois `drop column` das colunas novas e `drop index idx_yt_intel_titulo_active`.
- [ ] Antes do YES do `db:push:prod`, `npx supabase migration list` com só ela pendente.

**Aceite:** teste verde no 54421; `db:push:prod` só depois da revisão da T6 por Phil e Yannis (envio B0, pode subir antes do envio A). Estimativa: ~55 mil tokens.

### Task 7: Site — contexto congelado, pedido, validação e leitura

**Files:**
- Modify: `apps/web/src/lib/pipeline/services/forja-queue.ts` (`OBS_TYPES` + `'titulo-complementar'`; `AskInput.ownVideoId`, `signalId`; `AskSchema.refine` do tipo novo (exige os dois e `videoId` ausente); **`target_niche` do pedido = nicho do canal do terceiro mais forte do sinal** (`outlierMaisForte`, R2-P3); **`cancelReading` (R2-Y1):** `CancelSchema`/`CancelInput` ganham `ownVideoId` e `signalId`, o `.refine` do tipo novo os exige e, para `titulo-complementar`, `q = q.eq('target_own_video_id', …).eq('target_signal_id', …)` (hoje só `leitura-video` filtra por vídeo e o `delete` por nicho apagaria os pendentes de outros vídeos); `HeldTask` e as `cols` de `heldObsTask` (linhas 255, 288, 317, 386) leem `target_own_video_id, target_signal_id`; `CLAIM_COLS`/`readSent`/`completeReading` leem e gravam `target_own_video_id`, `target_signal_id`, `own_video_id`, `signal_id`), `apps/web/src/lib/youtube/observatorio/load.ts:136` (`OBS_TASK_TYPES`), `forja/sent.ts` (`buildSentCtx` é síncrono sobre `ForjaCtx` e o `niche_signals` não está no dataset: o sinal é lido no `readSent` antes do pack; ramo `titulo-complementar` → `tituloComplementarPack`), `forja/novidade.ts`/`planAsk` (regra de novidade do tipo: alvo = vídeo nosso × sinal; "dado novo desde a última leitura do mesmo alvo"), `forja/scope.ts` e `forja/states.ts` (rótulo "títulos complementares")
- Create: `apps/web/src/lib/youtube/observatorio/forja/titulo-complementar.ts`, `apps/web/test/fixtures/titulo-complementar-casos.json` (copiado para `fixtures_site/` do kit na T8)
- Test: `apps/web/test/youtube/observatorio/forja/titulo-complementar.test.ts`

**Interfaces (Produces):**
- `REGRA_F4_TITULO = { k: 5, maxCaracteres: 100, titulosPassadosMaxCaracteres: 5000, outliersMax: 5 } as const` — o teto de títulos passados é por **caracteres** (≈ 80 títulos; P4/Y3a: 200 × ~60 = ~12.000 já estoura `MAX_PROMPT = 12000`), medidos antes pelo T0(e); mais recentes primeiro.
- `tituloComplementarPack(ctx: ForjaCtx, alvo: { ownVideoId: string; signalId: string; outliersCongelados: ... }): SentPack` — congela: título e início da descrição (300 caracteres) do vídeo nosso; títulos passados do dono em **todos os canais próprios** (D3) até o teto de caracteres; lugar (`nomeDoLugar(subject_key)`, agora na lib); até 5 títulos dos outliers do sinal (públicos); `sent.titulos_enviados_n` (o que entrou de fato); `sent.numbers` = multiplicadores e views/dia dos outliers **mais os números presentes nos títulos enviados** (dono e outliers; Y3b: títulos de viagem têm "3 dias", "10 praias"), pela forma canônica de `forja/numbers.ts`. Falha de alvo lança `TargetUnavailableError` (`forja/sent.ts:45`, 422 sem nova tentativa), não `ErroAlvo`. Sinal fechado entre o pedido e o claim (pode passar de 10 min): o pack usa os **outliers congelados no pedido** (o `askReading` grava o contexto dos outliers no `sent` da tarefa, que a tabela já tem; conferir em `heldObsTask` na leitura), não lança.
- `validarTitulosComplementares(sent: SentPack, itens: string[]): { ok: true; itens: string[] } | { ok: false; motivo: 'demais' | 'longo' | 'repetido' | 'numero_fora' | 'vazio' }` — chamada em `completeReading` para esse tipo: ≤ 5 itens; cada um com 1 a 100 caracteres; nenhum igual (após `normForNumbers` sem pontuação) a título passado do dono nem a título de outlier (`Set` de normalizados, não `includes` em array); **a comparação de repetição usa também os hashes normalizados de TODOS os títulos próprios**, guardados no `sent` (O(T), barato), e não só os que couberam nos 5.000 caracteres (R2-P6/Y4); gatilho no ledger: `titulos_enviados_n < total de títulos`; números ⊂ `sent.numbers`. A regra e os casos vivem em `titulo-complementar-casos.json` (entrada → `ok`/motivo), lido pelo Vitest aqui e pelo `teste_obs_pacotes.py` na T8 (Y3c).
- Leitor: o resultado de um pedido é lido por `own_video_id` + `signal_id` em `competitor_readings` (índice da T6).

- [ ] **Step 1 (FAIL):** pack de vídeo com 250 títulos passados respeita o teto de caracteres e grava `titulos_enviados_n`; pack sem sinal aberto e sem outliers congelados lança `TargetUnavailableError`; com outliers congelados e sinal fechado, monta; `sent.numbers` inclui o "3" de um título enviado com "3 dias"; o validador cumpre todos os casos do JSON (6 itens, 101 caracteres, igual a um passado com acento ou caixa diferente, número fora, vazio); `AskSchema` recusa `titulo-complementar` sem `ownVideoId` ou com `videoId` de terceiro; dois pedidos para vídeos nossos diferentes do mesmo nicho passam e o mesmo vídeo × sinal volta "já há um pedido"; claim com `task_types: ['titulo-complementar']` passa no Zod; `planAsk` nega pedido sem dado novo para o mesmo vídeo × sinal; **`cancelReading` (R2-Y1):** dois pendentes de vídeos diferentes do mesmo nicho, cancelar um, o outro permanece; `cancelReading` do tipo novo sem `ownVideoId`/`signalId` → 400; pedido sem nicho derivável do sinal → recusa antes de gravar (R2-P3).
- [ ] **Step 2–4:** implementar, PASS. Pedido: a server action da T9 chama `askReading` com `type: 'titulo-complementar'`; idempotente pelo índice novo.
- [ ] **Step 5:** commit.

**Aceite:** testes verdes; sem o worker anunciar o tipo (heartbeat sem a capacidade), o botão fica "a forja ainda não sabe fazer isto" (estado existente de `states.ts`), nunca fila parada calada. Estimativa: ~140 mil tokens.

### Task 8: Kit da forja — tipo, prompt e validador (agente edita o kit local; o dono instala)

**Files (git local `~/Workspace/forja/ferramentas`):** `docs/trilha/leituras_obs.py` (`TIPOS_TODOS` e `TIPOS` + `'titulo-complementar'`; `_tarefa`/`montar`/`prompt` do tipo; `validar` com as mesmas regras de `validarTitulosComplementares`), `docs/trilha/teste_obs_pacotes.py` (casos), `docs/trilha/fixtures_site/titulo-complementar-casos.json` (cópia do arquivo da T7) e uma fixture de pacote.

- [ ] **Step 1 (FAIL):** em `teste_obs_pacotes.py`: o prompt do tipo cabe em `MAX_PROMPT` (12.000) com o teto de caracteres da T7 **e todos os títulos do `sent` chegaram ao prompt** (o teste falha se `_prioridades()` cortar algum título, P4/Y3a); o validador cumpre os mesmos casos do JSON compartilhado (paridade de regra, Y3c); `causa_thumbnail` segue ativo.
- [ ] **Step 2–3:** implementar; `python3 -m pytest docs/trilha/teste_obs_pacotes.py` (ou o runner do kit) verde; ensaio (`ensaio_obs.py`) mede a **taxa de recusa** do validador com títulos reais antes da T10 (resultado no ledger; taxa alta por `numero_fora` volta à T7); `git commit -- docs/trilha/leituras_obs.py docs/trilha/teste_obs_pacotes.py docs/trilha/fixtures_site/<arquivos>`.
- [ ] **Step 4: comandos do dono** (só depois de T6 em produção e T7 no ar; o controlador manda na hora, não antes; um por linha, cada um num bloco): copiar **literalmente** o runbook `docs/ops/forja-fila-inteligencia-runbook.md` §2 (instalação, com o portão `KIT-IGUAL` e a lista de commits do kit ainda não instalados mostrada ao dono antes, via `git log`, porque a cópia da forja está atrás e `scp -r trilha` levaria tudo, H8/Y9a) e §4 passo 3 (teste na forja com `/opt/agente/venv/bin/python -B`, `unset PYTHONPATH AGENTE_BASE`, `AGENTE_SITIO`/`AGENTE_FILA` exportados e `flock -w 1800` com a mensagem `PARE`, Y9b); o `KIT-IGUAL` roda de novo depois. Confirmação (agente pode rodar): `ssh forja 'grep -n "^TIPOS" /opt/agente/docs/trilha/leituras_obs.py'`.
- [ ] **Rollback concreto (Y9c):** commit no kit revertendo o `titulo-complementar` do `TIPOS`, e instalar só `trilha/leituras_obs.py` e o teste pelos mesmos passos do §4 (comandos mandados na hora). O site segue aceitando o tipo sem efeito.
- [ ] **Step 5:** conferência: o próximo claim tipado grava heartbeat com `titulo-complementar` nas capacidades (SQL de leitura no ledger).

**Aceite:** heartbeat com a capacidade nova; um pedido de teste vira `competitor_readings` com ≤ 5 títulos válidos. Estimativa: ~80 mil tokens.

### Task 9: Tela dos títulos (Cowork só lê na v1)

**Files:** os do mockup em `_sugestoes/` (componente client recebe a ação por prop; a server action em `_sugestoes/actions.ts` chama `askReading` depois de `requireSiteAdminScope`); leitura do resultado pelo leitor da T7; leitura dos títulos no `youtube_observatory` (MCP) e na rota existente, **sem ação de pedido** (D-F4-4: `askReading` hoje só é chamado pela server action da tela, `competitors/forja-actions.ts:49`; pedir pelo Cowork exigiria rota + `api-registry.ts` + doc, e vai para o backlog); doc `cowork-docs-youtube.md`, reference e reseed dizendo que o Cowork lê o resultado, não o pede.

- [ ] Testes: o botão some sem permissão de admin; o estado "forja sem a capacidade" aparece quando o heartbeat não a lista; um pedido recusado pelo validador aparece como **recusado, com o motivo**, e não como lista vazia; o Cowork lê os mesmos títulos que a tela para o mesmo pedido; Gio a 1440 e 390 px.

**Aceite:** testes verdes, Gio aprova. Estimativa: ~90 mil tokens.

### Task 10: Revisão da F4-3 e envio

- [ ] Phil e Yannis (Opus `medium`) sobre T6–T9 (a T6 antes, para o `db:push:prod`); consertos Sonnet.
- [ ] Ordem de envio: (B0) `db:push:prod` da T6; (B1) push e promoção de T7 e T9; (B2) dono instala o kit (T8 Step 4). Rollback: T8 "Rollback concreto".
- [ ] **Conferência (controlador, lista vista pelo dono):** o heartbeat lista `titulo-complementar`; um pedido real termina em `competitor_readings` com **1 a 5** títulos que passam no validador do site (uma lista vazia com `ok` não passa); um pedido recusado pelo validador aparece na tela como recusado, com o motivo; o Cowork lê os mesmos títulos do mesmo pedido; a taxa de recusa do ensaio (T8) está no ledger.

**Aceite:** pareceres no ledger; 1º pedido real respondido com título válido ou recusa visível. Estimativa: ~80 mil tokens.

---

## F4-2: miniatura, análise e ideias (só planejada)

**Gatilho G2 (os dois, medidos):** (a) `f4-dado.sql` Q5 com `origens_monitoradas ≥ 1`, ou a F4-1 em produção mostrando ≥ 1 `sim` de terceiro de canal monitorado; (b) visão ligada na forja: `ssh forja 'curl -s http://127.0.0.1:8080/props'` com `"vision":true`. Conferência mensal no `ACOMPANHAMENTO.md` (a). A (b) só se prepara depois de (a).

**Pré-requisito da forja (dono, quando G2-a acontecer):** baixar o projetor de visão compatível com `gemma-4-12b-it` (mmproj, ~1 GB) para `/srv/models/` e reiniciar o `llama-server` da porta 8080 com `--mmproj <arquivo>`; a fila fica parada durante a troca (minutos). Medir antes a VRAM (RX 6800 XT, 16 GB; o modelo Q5 ocupa ~8,4 GB e o contexto `-c 49152` com `-np 2` o resto). Comandos exatos saem no plano próprio, um por linha.

**Esboço:** tipo novo `analise-miniatura` na fila (mesmo rito da T6–T8); a forja baixa as duas miniaturas na hora (`i.ytimg.com/vi/<id>/hqdefault.jpg`) e **não guarda** a imagem (D21, decisão do dono 29/10); o worker manda texto com os blocos fixos do §4 item 2 (texto, rosto/expressão, cor e contraste, composição, legibilidade pequena, diferença para a nossa) e uma lista de ideias; validador de números e `causa_thumbnail` ajustado só para esse tipo ("pode ajudar", nunca "causou"); **nenhum campo de imagem é preenchido** (teste de aceite do §7). Com `nao` ou `nao_medido`, nenhum pedido de miniatura nasce (decisão do dono). Estimativa quando o gatilho vier: ~350 mil tokens.

## F4-4: aliases propostos e tela de revisão (só planejada)

**Gatilho G4:** contagem do Phil (T0) em 2 a 3 semanas de F2: `outliersSemLugar` somado das rodadas da `sinais_do_nicho` ≥ 30 **ou** ≥ 20% dos outliers vistos. Abaixo disso, o v0 (precisão 0,9375 no T6b) basta e a F4-4 não paga o custo.

**Esboço:** tipo de fila `aliases-lugar` (forja recebe títulos de outliers sem lugar e a lista de `lugares`, propõe `alias → slug` com `ambiguo`); tabela nova `lugar_aliases_propostos` (só `service_role`, leitura por `can_edit_site`), tela de revisão (aceitar → insere em `lugar_aliases` e sobe `semente_versao`; recusar → guarda o motivo); mockup próprio. Estimativa: ~300 mil tokens.

---

## Envios e calendário

| Envio | Conteúdo | Condição | O dono vê |
|---|---|---|---|
| B0 (sem build) | migration T6 | revisão da T6; `migration list` só com ela; **pode subir antes do A** | nada |
| A (F4-1) | T1–T4 | mockup M aprovado; T5 com acordo; build verificado | a linha no cartão e no pacote; o Cowork com `sem_direito` declarado |
| B1 | T7, T9 | B0 em produção | botão com "a forja ainda não sabe fazer isto" |
| B2 (forja, dono) | kit T8 | B1 no ar; comandos pelo runbook §2/§4, na hora | botão ativo, títulos |
| F4-2, F4-4 | planos próprios | G2, G4 | — |

**Ordem da ida (portão duro, Phil):** B0 (`db:push:prod`) → conferir que `target_own_video_id` e `target_signal_id` existem → só então o deploy do código da T7 (`CLAIM_COLS`, `HELD_COLS` e `TASK_COLS` pedem as colunas para TODO tipo: sem a migration, a fila inteira da forja para, não só o título). Conferência logo após o deploy: `select task_type, status, count(*) from youtube_intelligence_tasks where requested_at > now() - interval '2 hours' group by 1,2;` (diagnóstico e padrões seguem indo a `done`, sem `failed` novo).

**Ordem da volta (C-Y5, Yannis):** kit → site → migration, nunca parcial. (1) kit: T8 "Rollback concreto" (a forja deixa de anunciar `titulo-complementar`; `KIT-IGUAL` conferido); (2) site: `git revert` de T7/T9 e promoção; (3) só então o bloco "CAMINHO DE VOLTA" da migration `20261029000003` (que faz `drop column`). Reverter só o site com o kit novo instalado faz o claim ser recusado e a fila para calada; rodar o `drop column` com a T7 no ar faz o claim dar erro para diagnóstico, padrões e temas. A mesma ordem vai no passo de rollback da T10 (e em `t8-instalar.md`, a cargo do executor do kit).

Ordem de execução: (1) T0 e T1; (2) T2, T3, T6, T7 e o mockup M em paralelo (executores separados); (3) T8 (kit local, sem instalar); (4) dono aprova o mockup, depois T4 e T9; (5) T5 sobre T1–T4 e, separada, a revisão da T6; a T10 sobre T7–T9 depois ou junto. Datas: nenhuma espera dado; as esperas são a aprovação do mockup e a instalação do kit pelo dono.

## Decisões em aberto para o dono

Padrão recomendado em todas; o dono confirma ou troca. Sem resposta, vale o padrão.

| # | Pergunta | Padrão recomendado (minha, de Hanna, Phil e Yannis) | Custo de cada lado |
|---|---|---|---|
| D-F4-1 | O Cowork (chave permanente) lê o estado "já recebo tráfego" (Analytics privada do dono)? | **Não nesta v1: rota e `get_signals` devolvem `nao_medido: sem_direito`, declarado no doc, como dívida até a porta do perfil (`porta.ts` → `provarAcessoPrivadoDaChave`) ligar no MCP.** O teste da T3 afirma essa diferença. Não existe hoje caminho de prova para a chave permanente (`ServiceContext` sem `userId`; sem chamador); criar um é uma terceira porta de leitura privada, mudança de segurança com spec e portão próprios (Y1, P6, H4) | padrão: um envio com paridade quebrada, nenhum número errado nem dado privado fora do país sem registro por pessoa. Alternativa: porta nova, spec próprio, sem estimativa |
| D-F4-2 | F4-3 entra, colada na F4-1? | **Sim**: o spec só condiciona a miniatura; título é a ação do "não" | sim: ~510 mil tokens, valor imediato. Não: o cartão diz "não, a ação é título" e não oferece título |
| D-F4-3 | F4-2 só planejada (sem código atrás de flag) até o G2? | **Sim** | planejar: zero agora. Codificar: ~200 mil tokens sem prova de ponta a ponta (visão desligada) |
| D-F4-4 | O Cowork também **pede** títulos? | **Não na v1: só lê** os que a tela pediu (H3: o `askReading` não está exposto ao Cowork). Pedir pelo Cowork vai ao backlog | pedir também: rota ou ação MCP + `api-registry.ts` + doc, sem estimativa (pedir ao Yannis) |
| D-F4-5 | T6–T8 em paralelo com o mockup; mockup único (linha + botão)? | **Sim** | um rito e uma ida ao Opera a menos; risco de refazer layout evitado |

## Estimativa total

F4-1: T0 25 · T1 50 · T2 85 · T3 65 · M (parcela do cartão) 65 · T4 85 · T5 90 ⇒ **~465 mil tokens**. F4-3: T6 55 · T7 140 · T8 80 · M (parcela do botão) 65 · T9 90 · T10 80 ⇒ **~510 mil** (Yannis). Total planejado e executável agora: **~975 mil**. F4-2 (~350 mil) e F4-4 (~300 mil) só com gatilho. Sonnet executa; Opus só na 1ª revisão de Phil e Yannis.

## Fora deste plano

"Meu vídeo caiu" e o portão de volume (volta com vídeo nosso ≥ 3 views/dia por 28 dias); leitura fresca de `RELATED_VIDEO` pela Analytics (D-2 da F2b, adiada); `feito` por efeito observado (D-4 da F2b); embedding de miniatura; pedir títulos pelo Cowork (D-F4-4; volta quando o dono pedir pelo Cowork ou depois de 2 semanas de uso da tela); ligar a prova do perfil no MCP (dívida da D-F4-1); retenção do `sent` de leituras de título (~15 KB por pedido, ~55 MB/ano a 10 pedidos por dia, Phil; volta se o volume real passar de 10 pedidos por dia ou a base chegar a 300 MB). O "F4-K1" do ledger antigo é o portão do S8-F4 (outra F4) e não se aplica.
