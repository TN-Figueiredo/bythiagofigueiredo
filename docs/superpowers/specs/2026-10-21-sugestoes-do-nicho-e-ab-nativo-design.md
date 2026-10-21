# Spec: sugestões a partir do nicho e A/B com o teste nativo como caminho principal

- **Data:** 21/10/2026. **Estado:** r4 (Sonnet), conserta a re-revisão da r3 (Yannis 80/100: B1–B4, I1–I9; Phil 82/100: A1–A9, M1–M10; decisões em §14). A r3 consertou a adversarial da r2 (55/100, §13) e a r2 a r1 (66/100, §12). Para a re-revisão deles e, nas telas, de Logan e Naksu.
- **Libera (quando Phil e Yannis concordarem):** escrever o plano da fase F0 (coleta). **Não libera:** código, migration, mockup aprovado, deploy. Os dois revisores já liberam o plano da F0 (Phil: sim; Yannis: sim se B1–B4 entrarem, o que a r4 faz). **Regra do plano, primeira tarefa (Yannis I9):** rodar `npm run db:new` só numa árvore em dia com `origin/staging` (o checkout local está atrás: última migration local `20261015000001`, em `origin/main` `20261021000001`); sem stash nem reset, usar worktree limpo de `origin/staging` se houver trabalho de outro terminal; teste que a migration nova é a maior do diretório.
- **Fontes:** `.superpowers/sdd/ab-lab/sugestoes-de-teste-discussao/` (decisões do dono de 21/10, planos e pareceres, `review-spec-r1-phil.md`, `review-spec-r1-yannis.md`, `review-spec-r2-adversarial.md`, `review-spec-r3-phil.md`, `review-spec-r3-yannis.md`, parecer do Phil sobre o algoritmo, replanejamento do A/B) e `../nativo-vs-nosso-recomendacao/parecer-phil.md`.
- **Legenda:** [V origin/main b04049787] conferido em `origin/main` em 21/10 (um `git grep`/`git show` por item; o checkout local está atrás e **não serve**); [PROD] medido em produção por Phil em 21/10 (SELECT); [P] afirmado por um parecer e não reconferido; [a conferir] dúvida que o plano resolve antes de construir.

## 0. Problema e objetivo

Hoje o sistema só olha para o sucesso dos vídeos do próprio dono e o A/B Lab trata o nosso teste (rotação por tempo) como caminho principal. Dois fatos mudaram isso:

1. **O sucesso do nicho é o sinal mais rico que temos.** O observatório (A5) já coleta quase tudo dos canais de terceiros, mas a leitura é manual (tela de Outliers). A hipótese principal do dono: quando um vídeo grande sobre um destino bomba, o YouTube passa a recomendar outros vídeos daquele destino, inclusive os antigos e menores do dono. A experiência dele (Vietnã, vietnamita: uns 10 canais recomendados depois de assistir a um) indica recomendação por tema **forte**. O parecer do Phil não achou prova oficial: o mecanismo é plausível (Sugeridos e Busca), não provado. **O spec trata o sinal por destino como hipótese principal a medir** (método em §3.6), não como aposta fraca.
2. **O teste nativo do YouTube (Test & Compare) é melhor que o nosso onde ele roda e há volume:** divide o público ao mesmo tempo e mede tempo assistido. O nosso mede por tempo alternado, com viés de dia e de idade [P, parecer nativo × nosso §2].

**Objetivo:** transformar o sucesso do nicho em ação concreta e barata no acervo e na pauta do dono, a partir de uma fonte única de sinais, **gravada uma vez por dia e lida por tabela** pela tela, pelo contador e pelo Cowork; e fazer do teste nativo o caminho principal, com o nosso como exceção que só dá **indício**. A coleta vem antes de tudo, porque dado que a origem expira não volta. Princípio do dono (21/10 12:35): maior performance, menor custo, nada duplicado; cada peça abaixo reaproveita o que existe (§2 e §3.7).

## 1. Decisões

| # | Decisão | Motivo | Fonte |
|---|---|---|---|
| D1 | ASAP: entregar o mais cedo possível; a data dos canais novos (fim de nov a 07/12) é estimativa e não é folga | pedido do dono | decisões 21/10 12:10 |
| D2 | Sinal por destino ("destino esquentou") é a hipótese principal, medida com o nosso dado (§3.6, fase F2b); texto da tela "pode ajudar", nunca "vai ajudar" | experiência do dono pesa; não há prova oficial | decisões 21/10; Phil algoritmo §5.5 |
| D3 | Coleta máxima em **todos** os canais próprios (novos, antigos e parados), a partir da implantação, sem backfill retroativo e sem discriminar por volume | correção do dono 12:15 | decisões 21/10 |
| D4 | A resposta 4 do dono ("remover canais vazios") vale só para a lista de canais acompanhados do nicho, não para canais próprios | correção do dono 12:15 | decisões 21/10 |
| D5 | Já coletamos "tudo deles"; falta cruzamento (contexto, lugar, comentários). Gemma só no campo `lugar` (§2.4 T2). Comentários de terceiros: Cowork/MCP recebem só agregados, nunca autor nem texto inteiro (LGPD, transferência internacional); a forja local pode ler o texto | resposta 2 do dono; Phil M3 | decisões 21/10 |
| D6 | **Uma régua de "bombou"**: item de `outliers(ctx, { maxAge: 30 })` com `!weak` e `phase.id === 'estourando'` (interseção, sobre o mesmo motor da tela). Sem segundo conceito no A/B Lab | paridade Cowork × Claude Code; Yannis I1 | §3.4 |
| D7 | Núcleo puro calcula; eventos gravados numa tabela; **calcula-se só no gravador (1×/dia); a leitura é só a tabela** | Phil I9, Yannis I2 | §3.4 |
| D8 | Ação de terceiro não pré-preenche com a imagem dele; a thumbnail de terceiro é referência de estilo | risco de cópia | Logan §3, Naksu §2, Phil §8 |
| D9 | Regra nativo × nosso: vídeo longo elegível = nativo; Short, kids, 18+, estreia/live agendada e lote = nosso, rotulado "indício por tempo alternado" | parecer nativo × nosso §5 e §8 | Hanna e Yannis replanejar |
| D10 | Portão de volume nas ações de teste de vídeo **publicado há ≥ 7 dias** (< 7 d é lançamento, sem portão): sem volume, "Sem volume para teste. Trocar direto?". No lançamento (estreia ou ≤ 7 dias) o caminho é nativo sem portão ("o YouTube decide se há volume") | 0 de 33 vídeos com ≥ 100 impressões em 28 dias [PROD, máx. 21]; Yannis I5 | Logan replanejar §2 |
| D11 | Marcador manual "Em teste no Studio" **é sempre aceito** e pausa o nosso sem escrever (mudança em `settleOnAir`, §5.2); a ordem pausar → restaurar → confirmar vale só para habilitar "Abrir no Studio" (§5.2) | escrever durante o nativo cancela o teste; Yannis B2 | spec S6/S7 §6.6 |
| D12 | **Decidido pelo dono (21/10 12:35, sim):** "Original em alta": fica a regra 1280 (T1) e o aviso antes de iniciar; T2 a T18 congelam com gatilho | o nosso vira exceção; o defeito só aparece nele | decisões 21/10; Yannis replanejar §4 |
| D13 | Nome do botão e desenho final saem do mockup com Logan e Naksu | resposta 3 do dono | decisões 21/10 |
| D14 | Notificação do sistema (`createNotification`, tabela `notifications`, tipo `youtube.niche_signal`; §3.5) mais lembrete visual, no A/B Lab e em Competidores | resposta 5 do dono | decisões 21/10 |
| D15 | Ordenar pela força do sinal (medida), não por "ganho estimado em views" | Hanna D | hanna-plano §2 |
| D16 | Contador = sugestões abertas e não dispensadas (estado do produto), não "visto" por quem olha | paridade com o Cowork | Hanna E |
| D17 | **Decidido pelo dono (sim):** o bruto dos 10 tipos da Reporting fica sem prazo, comprimido. Fato: **já fica** [PROD] (§2.2 C1); a decisão só vira regra escrita e teste | "coletar mais do que usa" | decisões 21/10 12:35 |
| D18 | **Decidido pelo dono (sim):** thumbnail de terceiro com referência só quando já há tráfego vindo do vídeo dele (§4.2, F4) | o que traz o tráfego do outro é tema e título | decisões 21/10 12:35 |
| D19 | Reaproveitar a Reporting antes de chamar a Analytics; nenhuma coleta que repita dado já gravado | pedido do dono 12:35; Yannis I6, Phil I1 | §2 |

## 2. Coleta (fase F0, antes de tudo) e reconciliação

Regra (D3): vale para **todos** os canais próprios conectados, inclusive os parados, desde o dia da implantação, sem busca retroativa. Canal parado custa quase nada (linha esparsa; o banco rejeita linha com 0 views e 0 minutos, `yt_own_video_traffic_detail_daily_esparsa`, migration `20261013000006`) e dá a linha de base que hoje não existe. Termo de busca e URL externa podem ser dado pessoal: seguem o tratamento existente (`reporting/traffic-source-csv.ts`, hash do detalhe inteiro, corte em 300 caracteres) e a leitura dentro de `can_view_site`.

### 2.1 Fatos que corrigem a r1 [V origin/main b04049787] e [PROD]

- **Jobs da Reporting:** o passo `jobs` só roda para `channels.filter(c => c.sync_enabled)` (`coleta/index.ts:176`). Em produção os 2 canais próprios (tnFigueiredo, 35 vídeos; "Thiago Figueiredo", 0 vídeos) estão `sync_enabled = true`, `collection_status = ok` e **têm os 13 tipos `ativo`** [PROD]. Logo, hoje ninguém fica sem job. **Regra que garante canal parado coberto no futuro (r4, Yannis B2): um invariante, não dez filtros.** O filtro `sync_enabled` está também em `diario-step.ts:78`, `dimensoes-step.ts:206`, `criteria.ts:323,330,391,422`, `criteria-cobertura.ts:204`, `criteria-l2.ts:157`, `criteria-retencao.ts:127` e no passo de relatórios; criar job sem baixar nem cobrar seria perda silenciosa em 60 dias. Logo: "canal próprio conectado (token válido) ⇒ `sync_enabled = true`". (a) O callback de conexão grava `sync_enabled = true`; (b) critério novo em `criteria.ts`: canal próprio com token válido e `sync_enabled = false` é **ação do dono** ("ligue a coleta ou desconecte") e vermelho, nunca silêncio; (c) `ativos` e os outros filtros não mudam; desligar de propósito passa a ser "desconectar".
- **Bruto da Reporting:** `SEM_NORMALIZADOR` ainda diz no comentário "apagado 180 dias depois" (`reporting/types.ts:32`) e `reports-step.ts:592` ainda chama `yt_reporting_blobs_purge`, mas a função no banco **devolve 0** em produção desde a MG13 [PROD, `pg_get_functiondef`]. O bruto já fica sem prazo.
- **Detalhe da origem (`channel_traffic_source_a3`) chega com 16 dias de atraso**, não D+1 a D+3 [PROD: último `day_pt` 05/10; 22 relatórios `listado` de 09 a 19/10]. Causa (corrigida na r3): a faixa 2 de `fila-relatorios.ts:52-60` é ordenada **por vencimento**; 157 relatórios de histórico `listado` dos 9 tipos novos (criados 14 a 15/10, validade de 30 dias) passam na frente dos correntes (60 dias), e `traffic_source` tem 22 correntes esperando desde 11/10 [PROD]. O atraso é transitório (escoa por volta de 31/10, ~31/dia líquidos) e **volta a cada criação de job** (canal novo, C6). `fila-relatorios.ts:35` põe na faixa 1 só `REACH_TYPES`; F0-a continua certa.
- **`topicDetails` já é pedido e já é gravado** (resolvido, M2): 1.754 de 1.911 raws atuais o têm [PROD]; o salto de 8,6 MB já aconteceu em 17/10. Pedido desde 17/10: `VIDEO_PARTS = 'snippet,statistics,contentDetails,liveStreamingDetails,status,topicDetails,paidProductPlacementDetails,localizations,recordingDetails'` (`competitor-sync.ts:28`, commit 6c8f34955). A r1 tratava como pendente.
- **Termos e detalhe de origem não expiram na Analytics** (aceita `startDate`/`endDate` passados). Só expiram na origem os relatórios da Reporting (60 dias corrente, 30 histórico) e os `playlist_*`, que não estão habilitados.

### 2.2 Tabela de reconciliação: o que já coletamos × lacuna × conserto

Nenhuma linha cria segunda coleta do mesmo dado. Cadência da coleta própria: `sync-analytics-metrics` 1×/dia 12:00 UTC (`vercel.json:25`), 300 s.

**Canais próprios (2 conectados)**

| # | Informação útil | Onde já está (tabela · fonte · cadência · retenção) | Lacuna medida | Conserto |
|---|---|---|---|---|
| R1 | Views e minutos por vídeo e dia | `yt_own_video_daily` · Analytics · diário · sem prazo | nenhuma | — |
| R2 | Impressões e CTR por vídeo e dia | `yt_own_video_reach_daily` · Reporting `channel_reach_basic_a1` · faixa 1 · sem prazo | nenhuma (D+4) | — |
| R3 | Impressões por origem e aparelho | `yt_own_video_reach_dim_daily` · `channel_reach_combined_a1` | nenhuma | — |
| R4 | Views por tipo de origem, aparelho/SO, país, inscrito | `yt_own_video_dim_daily` · Analytics `analytics-dimensoes.ts` · diário, janela 10 dias, teto 400 consultas · ligado em 20/10 | nenhuma; o teto estoura com ~100 vídeos com view/dia (R16 abaixo) | — |
| R5 | **Detalhe** da origem (RELATED_VIDEO = id do vídeo que levou ao nosso; YT_SEARCH = termo; URL; canal) | `yt_own_video_traffic_detail_daily` · Reporting `channel_traffic_source_a3` · sem prazo | **16 dias de atraso** [PROD] (causa: ordem por vencimento, §2.1); YT_SEARCH de pouco volume vem com `detail = ''` | **F0-a:** subir o tipo para a faixa 1 da fila |
| R6 | Termos de busca do canal | soma de R5 (`YT_SEARCH`); `fetchYtSearchTerms` (`analytics-client.ts:275`) só sob demanda | não gravado como visão; **não expira** | **visão SQL sobre R5** (zero job); Analytics semanal só pelo gatilho de r2 R3 |
| R7 | Detalhe da origem pela Analytics (era C2) | duplica R5 e é pior (top 25 por consulta) | — | fora do diário; só na janela de evento (§2.3 C4), ≤ 20 consultas/dia |
| R8 | Retenção de audiência | `yt_own_video_retention` · diário | nenhuma | — |
| R9 | Demografia, local de reprodução, província, legendas, cards, telas finais, compartilhamento, basic, combined, device | bruto gz em `yt_reporting_report_blobs` · sem prazo (purge devolve 0 [PROD]) | **a perda que a C1 da r1 queria evitar não existe**; falta só normalizador | C1 vira "nada a coletar": só corrigir o comentário (o teste `purge = 0` já existe como verificação em `reports-step.ts:595`, M3); normalizar sob demanda do bruto |
| R10 | Desempenho de **playlist** | nada; 6 tipos `playlist_*_a2` existem, `desativado` | **expira na origem (60 dias)**; sem isso a ação 3 (§4) nunca é medida | habilitar quando a fila baixar (§2.3 C6) |
| R11 | Views públicas por hora do próprio (E15) | `yt_own_public_video_hourly` · 14 dias após publicar | 0 linhas hoje (sem publicação recente); não é defeito | conferir na 1ª publicação do canal novo |
| R12 | Título, miniatura, descrição (versões); metadados diários | `yt_own_video_versions`, `yt_own_video_meta_daily` | canal com 0 vídeos não grava tentativa de `meta` nem `diario` (`diario-step.ts:109` faz `continue`) | gravar `outcome: 'sem_videos'` |
| R13 | Estado do canal | `yt_own_channel_snapshots` | nenhuma | — |
| R14 | Jobs da Reporting por canal | `yt_reporting_jobs`: 13 tipos `ativo` nos 2 canais [PROD] | nenhuma hoje; o filtro `sync_enabled` é risco futuro | invariante de §2.1 (B2) |
| R15 | **Lugar** dos vídeos próprios | nada | sem campo; busca textual erra em "Vietnã"/"Vietnam" | lugar v0 determinístico, tabela `lugares` (§2.4 T2), também nos próprios |
| R16 | Capacidade de download | 40 a 70/dia medido, ~90% `vazio` [PROD]; `MAX_DOWNLOADS = 100`; gargalo real é o 429 por minuto da Reporting (`reports-step.ts:19`) | com 4 canais × 13 tipos = 52/dia (76 com playlists) estoura | F0-c (§2.3) |

**Terceiros (31 canais, 1.880 vídeos, 166 nos últimos 30 dias, 53 Shorts) [PROD]**

| # | Informação útil | Onde já está | Lacuna | Conserto |
|---|---|---|---|---|
| R17 | Resposta crua de `videos.list` | `competitor_raw` (só quando muda; 4.806 linhas, 21 MB) · sync de 20 min; campos versionados em `field-catalog.ts:5` | `topicDetails` já pedido; se o hash inclui as partes, a 1ª leitura de 17/10 regravou tudo (~8 MB, único) | T1 vira só conferência (§2.4) |
| R18 | Views diárias e marcas de idade | séries diárias + `competitor_video_marks` (migration `20261014000004`; desde 15/10: 129 marcas, D7 em 23 canais, só 1 com ≥ 8) | n ≥ 8 **de marcas** é inviável por semanas | n conta vídeos com `vpd7` no mesmo formato (§3.1) |
| R19 | Curva horária | `competitor_video_hourly` (migration `20261013000002`): 114 vídeos, mediana de 161 h; regra até 14 dias (`horaria/regra.ts`) | nenhuma; fecha o "[a conferir]" antigo e o item "2×/dia" de §10 | — |
| R20 | Título e descrição em texto | `competitor_video_versions.value_text` | nenhuma | a T2 e o casamento leem daqui |
| R21 | Comentários e autores | tabelas da E14 | nenhuma | D5 (só agregados ao Cowork) |
| R22 | Tema | leitura `temas` da forja (`observatorio/load.ts:133`, `OBS_TASK_TYPES`); `competitor_readings` tem **0 linhas** e `youtube_intelligence_tasks` só tem `diagnostico` nos últimos 30 dias [PROD] | tema não é lugar; a forja nunca produziu leitura do observatório | fora do caminho crítico: o lugar v0 não depende dela (T2) |

**Resumo:** dos 22 itens, 16 já estão cobertos. Sobram 3 coletas novas de verdade (R10 playlists, R6 como visão, R15 lugar dos próprios), 1 conserto de prioridade (R5), 1 motivo ausente (R12) e 1 campo derivado (lugar). **O que expira na origem e ainda não coletamos é só R10.**

### 2.3 Itens da F0 (próprios)

| # | Item | Cota / custo | Quando |
|---|---|---|---|
| F0-a | Fila: faixa 1 = `REACH_TYPES ∪ {'channel_traffic_source_a3'}` (`fila-relatorios.ts:35`), com teste de ordenação. Esperado: D+2 a D+4. **Conferência por canal (não por `max(day_pt)`, que não depende da coleta num canal de ~0,5 view/dia):** existe `yt_reporting_reports` de `channel_traffic_source_a3` com `status in ('baixado','vazio')` e `end_time >= hoje − 4` | zero | `fila-relatorios.ts` (calendário em §7: espera a promoção da A5) |
| F0-b | Invariante "conectado ⇒ `sync_enabled = true`" (§2.1: callback grava `true`; critério que acusa `false` com token válido como ação do dono) e `outcome: 'sem_videos'` nos passos `meta` e `diario`. "Conectado" = token válido (M6): canal em `reautorizar` não vira vermelho. Migration do `check` de `outcome` antes do código, se preciso | zero (Reporting não gasta cota) | após a promoção da A5 (`coleta/index.ts`, `criteria.ts`) |
| F0-c | Capacidade (I2, **não é só `vercel.json`**): a rota `sync-analytics-metrics` não tem modo parcial, e repetir a entrada dobraria a cota da Analytics e da Data API. Adicionar `?passos=jobs,relatorios,alcance,normalizadores` e uma entrada às 00 UTC com esses passos (Yannis B1, **isolamento completo**): (1) `parsePassos` com Zod (`z.array(z.enum([...])).min(1)`; passo desconhecido → 400 sem tocar o banco); (2) com `passos` presente a rota **não** chama `parteAntiga`, `metadados`, `versoes`, `dimensoes` nem `diario`, e `PASSOS_LIGADOS` (`coleta/index.ts:39`) vira parâmetro, não constante global; (3) veredito sob nome próprio, `recordCron*('sync-analytics-metrics:parcial')`, no vigia com o mesmo limiar de 26 h; (4) `yt_own_collection_runs` ganha `escopo text` (`completo`|`parcial`); (5) confirmar no Vercel que duas entradas com o mesmo `path` e `query` diferente são aceitas; plano B: rota irmã `sync-analytics-metrics-parcial/route.ts` de poucas linhas que importa a mesma função. Testes: `passos=relatorios` não chama `parteAntiga` nem a Analytics; falha da parcial não grava sucesso do completo; completo vermelho + parcial verde continua vermelho no vigia; **sem `?passos` o comportamento é o de hoje** (regressão; é este o teste de "padrão" da rota, que não cria variável). Gatilho: antes de conectar o 1º canal novo. Conferência: D+7, `listado` com idade > 7 dias = 0 | 1 cron a mais, sem cota extra | antes do canal novo (espera a promoção da A5: `route.ts` e `coleta/index.ts`) |
| F0-d | C1: corrigir o comentário de `SEM_NORMALIZADOR` (o teste `purge = 0` já existe como verificação, M3); teste de que o arquivamento no NAS só apaga com `nas_confirmed_at`. Orçamento: ~745 B/bruto × 26/dia ≈ 7 MB/ano (~10 com playlists), alerta no `tamanho_do_banco` existente | zero | com F0-b |
| F0-e | C3: visão SQL de termos sobre `yt_own_video_traffic_detail_daily` | zero job | com a F0 |
| C4 | **Janela de evento = marcador + consulta, não coleta nova.** Para cada evento (§3.1), marcar os vídeos nossos com a mesma chave de lugar e ler -28..-1 e +1..+30 do que R1 e R4 já gravam (a Analytics responde janela passada, então a janela pré **não** depende de coleta nova; janelas em §3.6). Leitura fresca de RELATED_VIDEO pela Analytics só nesses vídeos, ≤ 20 consultas/dia, `mapLimit`, gravada em R5 com `source = 'analytics'` (a Reporting sobrescreve quando chega) | < 0,5% da cota | F2b |
| C5 | Canal novo: mesmo pacote no mesmo dia, sem passo manual (já é consequência de F0-b) | — | com F0-b |
| C6 | `playlist_*`: habilitar os 6 tipos em `REPORT_TYPES_ENABLED` **só quando `listado` < 60** (~31/10 na folga atual de ~19–31/dia). Ligar tudo agora soma 310 + 360 = 670 pendentes e estoura os 30 dias de validade do histórico. O histórico de 30 dias que o YouTube gera ao criar o job é brinde, não backfill pedido; perder parte dele não é falha. Conferência: D+7, zero `expirado_sem_baixar` em `playlist%` | +12 downloads/dia | ~31/10 |

### 2.4 Terceiros e lugar

- **T1** (era "pedir `topicDetails`"): **resolvida**: já em produção e já gravado em `competitor_raw` (1.754 de 1.911; salto de 8,6 MB em 17/10) [PROD]. Sai do aceite da F0 (M2). `topicCategories` são páginas genéricas ("Tourism"): guarda-se por ser grátis; **não entra na T2**.
- **T2** (lugar, r4: Phil A1–A3, Yannis I7): **v0 determinístico e grátis, sem forja e sem conversão de coordenada.** (1) Texto: título, tags e início da descrição (`competitor_video_versions.value_text`), mais `locationDescription`. Uma só função `normalizarLugar()`: NFD sem marcas **mais tabela de dobra** (`đ→d, ł→l, ø→o, ı→i, æ→ae, œ→oe, ß→ss`), usada na semente, no casamento e no teste. (2) Semente: tabela `lugares(slug, pais_iso2, nivel, ambiguo boolean)` e tabela filha `lugar_aliases(alias_norm primary key, slug)` (um array não impede o mesmo alias em dois lugares); ~250 países em pt, en e nome local, mais ~100 destinos. Alias `ambiguo` (Natal, Porto, Lima, Cuba, Salvador, Belém, Vitória, Georgia, Jordan, Chad, Turkey) só conta com **segundo sinal** (país do mesmo lugar em tag ou descrição, preposição em/in/to antes, ou `recordingDetails` concordando). (3) `recordingDetails.location` **não** é o lugar do assunto: 34% das coordenadas (187 de 555 [PROD]) estão em pares (canal, coordenada a 0,1°) repetidos ≥ 5 vezes, localização padrão do canal. Entra só como confirmação ou desempate; sozinha vale apenas se o par (canal, coordenada) tem < 5 vídeos do canal. Sem GeoJSON nem caixas no pacote (as 559 `locationDescription` e as 555 coordenadas são o mesmo conjunto; o texto passa pela mesma tabela). (4) Casamento por **índice de n-gramas** `Map<alias_norm, slug>` (n até o maior alias, ~4): O(V·T) por execução, nunca O(aliases·V·T). (5) O vídeo produz um **conjunto** de até 3 chaves, ordenadas pela posição no título; o evento conta cada vídeo uma vez por chave. (6) **Armazenamento:** `video_lugares(video_id primary key, site_id, origem 'competidor'|'proprio', chaves text[], fonte 'texto'|'texto+coordenada', semente_versao smallint, computado_em)`, recalculado só quando muda `competitor_video_versions` do vídeo ou `semente_versao`; reexecução sem mudança não reescreve. `rule_version` inclui `semente_versao` (Phil M9). (7) A forja (F4) só **propõe** aliases, com revisão (tela de revisão na F4). Agrega em dois níveis, `pais:VN` e `local:vn-phu-quoc`; a F2 roda em `pais:` primeiro. Testes de tabela: "Phú Quốc", "Phu Quoc", "Đảo Phú Quốc", "Ilha de Phu Quoc", "Vietnã", "Vietnam", "Hồ Chí Minh", "Łódź", "İstanbul", "Tromsø" casam; "Georgia" e "Natal" sozinhos não casam; "Tailândia, Vietnã e Camboja em 15 dias" produz 3 chaves; canal sintético com 10 vídeos na mesma coordenada não gera lugar por `recordingDetails`; reexecução não reescreve. **Portão de precisão antes de ligar a notificação:** amostra de 100 outliers com lugar rotulado à mão, precisão ≥ 90%, mais 20 títulos negativos no teste; `OBS_SINAIS_NICHO` só liga com a notificação depois disso (resultado no ledger, D0 da 1ª execução). A contagem de outliers sem lugar fica visível (§8).
- **T3** (calibração): taxa de `estourando` por canal e formato **com o mesmo motor** (não `percentile_cont` sobre as marcas), medida em produção; o plano traz a contagem de canais com n ≥ 8 por esse critério.

Fora da coleta: transcrição de terceiros (a API só entrega legenda ao dono), embedding de miniatura, texto de comentário além do E14.

## 3. Sinal

### 3.1 "Destino esquentou" (hipótese principal, D2)

Evento por **lugar** (chave de T2). Dispara quando, para a mesma chave, há ≥ 2 outliers do nicho (régua D6) de **≥ 2 canais distintos** nos últimos 14 dias (uma série de um criador só não conta, Phil A3) **ou** 1 outlier muito acima da mediana do canal dele (parâmetros versionados, valores do Phil depois da T3). **n mínimo** = vídeos `tracked` com `vpd7` **no mesmo formato** (exatamente o que `median7` usa), não marcas. **Piso absoluto** = `vpd7 × 7` do mesmo `ObsVideo` (sugestão: 2.000), com a fonte no motivo. Validade do evento: 30 dias. A régua roda **por formato** (`long` e `short`): `outliers()` tem `fmt: 'long'` como padrão (`outliers.ts:62`) e 53 dos 166 vídeos recentes são Shorts [PROD]; sem isso a F2 declara "só longos" com esse motivo (I8).

Vira sugestão só com cruzamento: existe vídeo **nosso** com a mesma chave de lugar. Sem vídeo nosso, a sugestão é "vídeo novo".

**Não medido:** outlier sem `lugar`, canal sem n mínimo, ou vídeo nosso com base < 3 views/dia gera `nao_medido` com motivo; nunca "frio". Canal de terceiro com sync `atrasado`/`erro` vira fase `sem-ritmo` (`outliers.ts:22-24`) e some dos outliers: o núcleo devolve `motivoVazio: 'sync-atrasado'` com a contagem de canais `sem-ritmo` (I8).

### 3.2 "Vídeo parecido bombou"

Outlier do nicho (D6) casado com um vídeo nosso por filtro determinístico em camadas: mesmo nicho, mesmo formato, sobreposição de tokens de título, tags e início da descrição (pt e en), e lugar quando houver. A forja entra só na F4, para top-K (K ≤ 5) por vídeo nosso, nunca por par. A frase diz "mesmo lugar e mesmo tema" ou "tema parecido, lugar diferente".

### 3.3 "Meu vídeo caiu"

Queda de views/dia ou de CTR do vídeo nosso contra a mediana do próprio canal (ou do nicho, enquanto o canal tem menos de ~10 vídeos com série; declarado no motivo). É **gravado na mesma tabela** pelo gravador diário (depois do `sync-analytics-metrics`), para tela e Cowork lerem a mesma coisa. **Portão de volume (D10):** mostra impressões/dia e dias até o piso; se não chega em 28 dias, a ação é "Trocar direto". Regra exata, parâmetros e piso: Phil no plano.

### 3.4 Fonte única, gravador e leitura

- **Régua (D6):** `outliers(ctx, { maxAge: 30 })` (por formato, §3.1) com `!weak` e `phase.id === 'estourando'`. **Dívida fora da F2 (I6):** `outliers.ts:30` usa `2 *` fixo e `phaseOf` recalcula `m7` por item; trocar por `RULES.outlierMin *` (o valor é 2 nos dois casos, `rules.ts:10`) e pré-calcular `Map<canal|fmt, m7>` é item próprio, depois da promoção da A5, sem bloquear nada (1×/dia sobre ~166 itens é trivial).
- **Núcleo puro** `lib/youtube/observatorio/oportunidades.ts` (nome provisório): entrada = **projeção estreita** (`OutlierItem[]` já filtrados, vídeos próprios `{id, títulos, descrição normalizada, formato, lugar}`, `agora` injetado), não o `EngineCtx`; quem monta o `EngineCtx` é a borda. Saída = oportunidades com `tipo`, `motivo` (frase com os números, a versão da regra e a fonte do piso), `alvo`, `fonte`, `forca`, ou `motivoVazio` (`sem-historico`, `sem-terceiro-outlier`, `sem-lugar`, `forja-fora`). Nunca `[]` mudo. Teste do núcleo com literais, sem `createObservatory`.
- **Gravador (duas tarefas na agenda, Yannis B3, Phil M7):** (1) `sinais_do_nicho` (`agenda/definicoes.ts`, `periodo: 'dia'`, `aPartirDaHoraSP` depois de `marcas_de_idade` e da série diária, `ligaCom: 'OBS_SINAIS_NICHO'`, só `on` liga): monta o observatório, calcula, expira, grava e, em passos isolados (um erro não impede o seguinte; a tarefa fica vermelha com o motivo), roda a medida da F2b. (2) `avisos_pendentes` (`peso: 'leve'`, `periodo: 'dia'`, **sem** carregar o observatório e **sem** `ligaCom` de F2): lê só `niche_signals where notificado_em is null` e `ab_native_tests` (lembrete e fechamento do marcador, §5.3) e envia; `ligaCom: 'AB_NATIVO_REGISTRO'` para a parte do A/B, e a parte do nicho se autodesliga com a tabela vazia. Assim o lembrete do dia 14 (F1a) sai sem a F2. Zero cron novo. **Custo do gravador (I4, Phil A8), script antes do plano da F2:** a ferramenta do Cowork corre contra `PRAZO_DO_MOTOR_MS = 15_000` e esconde o resto; cronometrar por ela mede errado. O script (cliente de serviço, só SELECT) chama `loadRows`, `rowsToDataset`, `createObservatory` e `outliers`, cronometra cada etapa, 5 execuções a frio (`unstable_cache` vazio), conta idas e linhas lidas, mede a latência de uma ida de 1.000 linhas e **projeta a 90 e 365 dias** (a série diária tem 14.814 linhas em 19 dias, ~780/dia, ≈ 285.000 no teto de `DAILY_MAX_DAYS = 365`, ≈ 285 idas contra ~15 hoje; `load-measure.test.ts` com a forma de 365 dias). **Padrão: `peso: 'pesada', cedeA: ['sincronizar_canais']`** com `aPartirDaHoraSP` fora da janela dela; `leve` só se o p95 projetado a 365 dias for ≤ 10 s (tarefa leve começa até 75 s e termina em 85 a 88 s, `relogio.ts:8`). Aceite: p95 < `PESADA_FIM_MS` (285 s) − 60 s, lido em `competitor_agenda_runs`, conferido em D+30 e D+90. Roda 1×/dia (O(C·V·S), ~5 M pontos no teto). Latência de um `lugar` novo: até o dia seguinte.
- **Tabela** `niche_signals` (nome provisório): `site_id, kind, subject_key, rule_version, evidence jsonb` (ids, nunca imagem), `forca`, `status` (`aberto`, `dispensado`, `feito`, `expirado`), `first_seen_at`, `computed_at`, `expires_at`, `adiado_ate`, `dispensado_em`, motivo, `notificado_em`, `notificacao_tentativas smallint not null default 0`, `notificacao_falhou_em` (outbox, B3). **Índice único parcial `(site_id, kind, subject_key) where status = 'aberto'`**: no máximo um aberto por destino; `rule_version` fora da chave. `subject_key` = chave de lugar (destino), id do vídeo de terceiro (parecido) ou id do vídeo próprio ("meu vídeo caiu", M7). **Retenção sem prazo** (é o conjunto que mede D2, junto com `niche_signal_efeitos`, §3.6; ~0,1 MB/ano, sem dado pessoal). RLS de leitura `can_edit_site(site_id)`, teste que falsifica o GUC.
- **Escrita em lote, atômica (Yannis I1):** uma função `public.niche_signals_gravar(p_site uuid, p_lote jsonb) returns jsonb` (plpgsql, `security invoker`, `set search_path = ''`, `revoke ... from public; grant execute to service_role`, como `yt_watch_reter`), porque o PostgREST não infere índice **parcial** em `on conflict` (erro 42P10) e três chamadas deixariam estado parcial. Numa transação: (1) `update ... set status = 'expirado' where status = 'aberto' and expires_at <= now()`, **e, no mesmo passo, `update notifications set expired_at = now() where domain = 'youtube' and type = 'youtube.niche_signal' and dedup_key = 'nicho:' || id and expired_at is null`** (Phil A4: o sino conta `dismissed_at/expired_at/read_at` nulos, não olha `niche_signals`); (2) `insert ... on conflict (site_id, kind, subject_key) where status = 'aberto' do nothing`; (3) `update ... set evidence, forca, expires_at = greatest(...), rule_version, computed_at where status = 'aberto'`, nunca tocando `status` nem `dispensado_*`. Evento novo para a mesma chave só depois de `expirado`/`feito`, ou `dispensado` com 30 dias de carência (a função consulta). Devolve `{novos, atualizados, expirados}` para o log. A ação dispensar/feito faz o mesmo `update notifications`. Um destino que continua quente gera **novo** evento (e nova notificação) a cada ciclo `expirado → novo`: intencional (Yannis M4), com teto de 5 notificações/dia. Testes (banco local): chamadores concorrentes não duplicam; falha injetada no passo 3 desfaz 1 e 2; dispensar → reexecutar → continua dispensado; carência de 29/31 dias com relógio injetado; **dispensar a sugestão derruba o contador que `/api/notifications/count` lê**; contador cai sozinho com o gravador parado por 31 dias.
- **Outbox (B3, Phil A9):** a notificação não depende do insert; `avisos_pendentes` usa `fanOutToSiteAdminsDetailed` (`{total, sent, suppressed, errors}`, `fan-out-to-admins.ts:73`) e marca `notificado_em` **só** se `total > 0 && errors.length === 0` (suprimido por dedup conta como entregue); caso contrário incrementa `notificacao_tentativas` e, ao chegar a 3, grava `notificacao_falhou_em` e deixa a tarefa **vermelha** com o motivo (nunca engole, nunca repete para sempre; `total === 0` é erro). `dedup_key` `'nicho:' || id` e `'lembrete-nativo:' || id`; payload só com ids (sem `containsPii`). 1ª execução: grava com `notificado_em = now()` (linha de base) e envia **uma** notificação-resumo ("N sugestões novas"); depois, uma por evento, teto de 5/dia e o resto no resumo (o limite do `createNotification` é 100/h). `channels` não ativa e-mail nem push (Phil M8). Testes: lembrete sai com `OBS_SINAIS_NICHO` apagada; falha na 1ª e sucesso na 2ª não duplica; 3 falhas deixam a tarefa vermelha e param; `total === 0` é erro.
- **Leitura (tela, contador, Cowork):** só a tabela, `where status = 'aberto' and (adiado_ate is null or adiado_ate <= now()) and expires_at > now()` pelo índice parcial, com `count(*)` na mesma consulta; a tela mostra `computed_at` e "desatualizado" quando o gravador falha. `expirado` é derivado também na leitura, então contador velho não sobrevive a gravador quebrado.
- **`getSuggestedVideos`** (`apps/web/src/app/cms/(authed)/youtube/ab-lab/queries.ts:759`, hoje top 5 por nota e CTR com ≥ 1.000 views, sem paginação do limite de 1.000 linhas) vira leitora da lista. O chip "candidato" mantém a regra atual como `case` do núcleo (≥ 1.000 views, > 14 dias, não testado em 60 dias, nota/CTR).
- **Escrita (dispensar/feito):** server action com `requireSiteAdmin` no topo. Cowork: lê e dispensa pela ferramenta MCP existente `youtube_observatory` com ação nova (paridade D16), seguindo "Pipeline Integrity" (registry + doc) se houver rota.

### 3.5 Notificação (reescrita na r3, B1)

O sino lê a tabela `notifications`; `yt_notifications` está **morta** (7 linhas, última de 18/05; nenhum `.from('yt_notifications')` em `apps/web/src` além dos tipos) e `expire_old_yt_notifications()` só toca nela [PROD, V]. Usa-se `createNotification`/`fanOutToSiteAdmins` (`lib/notifications/fan-out-to-admins.ts`) com `domain: 'youtube'`, `type: 'youtube.niche_signal'`, `dedup_key: 'nicho:' || niche_signals.id` e `action_href` para a lista. `notifications` não tem CHECK de `type`; o dedup é `(site_id, user_id, dedup_key)`. **Sem** migration de CHECK, **sem** mudança em `NotificationType`, **sem** `expire-notifications` e **sem tocar o leitor do sino**: o gravador e a ação dispensar/feito marcam `notifications.expired_at` (§3.4, Phil A4). Envio por outbox (§3.4), uma vez por sugestão, nunca a cada tique. Teste de aceite que lê o que o **sino** lê (não só o banco), para não passar em verde com a notificação invisível.

### 3.6 Como a hipótese D2 é medida (fase F2b, r4: Phil A5–A7, M3–M6; Yannis I8)

**Honestidade sobre o dado de hoje:** impressões (R3) existem só de 08/09 a 17/10 (138 linhas, 193 impressões, 33 vídeos); views por origem (R4) desde 20/10; views totais (R1) desde 2015, mas esparsas (2.456 linhas, 1 na janela de 28 dias de um ano atrás); o canal próprio faz ~4,8 impressões/dia. **Placebo de 1 e 2 anos só existe para views totais (R1), e vazio para este canal; para impressões e views por origem não há passado, e não se inventa placebo sem dado.** Sem poder estatístico hoje: um evento com 3 vídeos nossos vê ~12 impressões no pré (desvio ~29%); separar +50% do ruído pede ~8 a 10 eventos com pré ≥ 30.

**Até o gatilho, a F2b só COLETA e grava a janela; nenhum número, par nem veredito vai para a tela ou para o Cowork.** Passa a medir quando valem **todas**: (a) ≥ 10 eventos fechados (n de eventos, ~dez/2026 a jan/2027, não é falha esperar); (b) Σpré ≥ 30 impressões (ou views) por braço, senão `nao_medido: volume`; (c) idade do dado: placebo de impressões só a partir de ~08/09/2027 (1 ano de R3); antes disso o veredito de D2 em impressões é **sem separação de estação** e a tela não diz "efeito", só "associação, não causa" com o controle (vídeos nossos sem a chave), e só depois de (a) e (b); para views totais o placebo vale quando Σpré do ano anterior ≥ piso. Enquanto (a) a (c) não valerem, o estado é `coletando`, com a contagem de eventos fechados.

- **Âncora:** `published_at` do outlier, gravado **na criação** em `niche_signal_efeitos` junto de `canal_id` (imutável: apagar um canal acompanhado, D4, apaga `competitor_videos` em cascata). `estourando` exige `vpd7` (≥ 7 dias de série), então o evento nasce 7 a 10 dias depois e a janela "em torno do evento" já conteria o efeito. Pré `[-28, -1]`, pós `[+1, +30]`. **Só o primeiro outlier do aglomerado de uma chave conta**: descarta-se o par se há outro outlier da mesma chave em `[pub−28, pub−1]` (`pre_contaminado`). Unidade = o outlier.
- **Fechamento por cobertura, não só por calendário:** fecha em `pub + 34` **e** só se existe `yt_reporting_reports` `baixado`/`vazio` do canal com `end_time >= pub + 31` (senão fica aberto até `pub + 60` e fecha `nao_medido: detalhe_ausente`). "Dia sem linha = zero medido" só se há tentativa `ok` da coleta própria naquele dia (`registrarTentativa`); senão `nao_medido: cobertura`.
- **Métricas:** (1) impressões por origem (R3: só dois códigos de origem com dado, 4 e 5; mapear para BROWSE/RELATED/SEARCH é `[a conferir]` no plano); (2) views por origem (R4); (3) prova direta: `RELATED_VIDEO.detail = id do outlier` (R5), sim / não / não medido.
- **Estimador por diferença, nunca razão cega:** `(Σpós/30) − (Σpré/28)` por braço (normalizado por dia, Phil M3), comparado entre alvo e controle; razão só quando Σpré ≥ piso, senão `nao_medido: base_zero` (nunca NaN nem divisão por zero). Bootstrap por evento com semente fixa, só com (a) a (c).
- **Tabela agregada por outlier** (Phil M4, ~20 linhas/evento, < 1 MB/ano): `niche_signal_efeitos(signal_id, outlier_video_id, canal_id, outlier_published_at, papel 'alvo'|'controle'|'placebo', metrica, anos_atras smallint, pre, pos, estado 'medido'|'nao_medido', motivo, fechado_em, versao_regra)`, `unique (signal_id, outlier_video_id, papel, metrica, anos_atras)`; `pre`/`pos` anuláveis e check de coerência (`motivo` obrigatório quando `nao_medido`). Gravada pela tarefa `sinais_do_nicho` quando fecha. Retenção sem prazo.
- **Aceite:** testes do núcleo com literais (âncora na publicação; fecha só depois de +34 e da cobertura; `Σpré = 0` não gera NaN; reexecução idempotente; placebo de métrica sem passado não é gravado; par com `pre_contaminado` descartado; nada vai à leitura antes do gatilho); consulta do Phil em produção de pares abertos e fechados; contagem de eventos fechados conferida em dez/2026 a jan/2027.

### 3.7 Reaproveitamento (nada duplicado)

| Peça | Reaproveita | Evita |
|---|---|---|
| Gravador | agenda do A5 | cron novo, 71 recálculos/dia |
| Régua | `outliers()` + `phaseOf` | régua e calibração duplicadas |
| Termos (C3), `RELATED_VIDEO` (C2/F4) | `yt_own_video_traffic_detail_daily` | job e consulta à Analytics |
| Bruto sem prazo (C1) | purge já devolve 0 | normalizadores agora |
| Notificação | `createNotification` / `notifications` (a tabela que o sino lê) | tabela nova e `yt_notifications`, morta |
| Marcador | registro `confirmado` da S6 §8.1 em `ab_native_tests` | tabela de marcador |
| Confirmar que o original voltou | `destinoDosCampos` (`ab-restore-acoes.ts:23`) + `ab-gravacao/sonda-step.ts` | leitor novo da página |
| Pausa sem escrever | `settleOnAir` **com motivo novo** `teste_youtube` (não existe hoje: **código novo**, §5.2) e o estado `pulado_teste_youtube` (só leitura em `ab-restore.ts:7`) | caminho paralelo |
| Rota/MCP | ação nova em `youtube_observatory` | ferramenta MCP nova |

## 4. Ações sugeridas (por ordem de custo)

Texto da tela: "pode ajudar". Cada ação é um `case` do núcleo e uma linha de teste, não um módulo.

1. **Título e descrição do vídeo antigo:** conferir se o lugar (chave de T2) está no título e na descrição; se faltar, propor a troca (ou o teste nativo, se houver volume, D10).
2. **Thumbnail com referência (D18):** o painel mostra a do terceiro ao lado da nossa como referência de estilo, com "Use como referência de estilo, não como cópia". Nunca pré-preenche com a imagem dele (D8). Ação plena só quando o detalhe `RELATED_VIDEO` mostrar que já recebemos tráfego daquele vídeo (sim / não / não medido); com "não", a ação recomendada é título ou tema.
3. **Playlist do destino** com os vídeos antigos do lugar (barata, sem risco; ganho é hipótese; medida por R10 depois de C6).
4. **Vídeo novo** sobre o destino, quando não há vídeo nosso ou com 2+ sinais.
5. **Título complementar:** compara com os títulos passados do dono (todos os canais próprios, D3) e evita repetir ângulo; geração pela forja só na F4 (task nova, contexto congelado, validador `forja/numbers.ts`).

## 5. A/B replanejado

### 5.1 Regra nativo × nosso (D9)

| Situação | Caminho |
|---|---|
| Vídeo longo, público, com volume | **nativo** (ficha "Testar no YouTube") |
| Lançamento (estreia ou publicado há < 7 dias) | nativo, **sem portão de volume**; nunca os dois juntos (M1) |
| Short, kids, 18+, estreia/live agendada | nosso (único caminho), "indício por tempo alternado" |
| Nativo indisponível no canal (sem "recursos avançados"/verificação; canal novo pode não ter, I7) | nosso, rotulado "indício" |
| Lote | nosso, para varrer e priorizar, não para decidir |
| Publicado há ≥ 7 dias, sem volume (hoje os 33 vídeos [PROD]) | nenhum: "Sem volume para teste. Trocar direto?" |

O sistema pré-escolhe o caminho e mostra o motivo; trocar fica atrás de "Prefiro outro caminho". Teste de tabela do portão (< 7 d sem portão, ≥ 7 d com): idade 0 d / 6 d / 7 d / 8 d × impressões 0 / acima do piso.

### 5.2 Marcador "Em teste no Studio" e a guarda

- Base: a guarda da S6 fase 2 (`avaliarGuarda`) **não existe no código** [V origin/main: zero ocorrências]. O registrador da S7 fase 1 existe (`lib/youtube/teste-youtube/registro/`), atrás de `AB_NATIVO_REGISTRO` (só `on` liga, `docs/ops/env-vars.md:21`), migration `20261018000006_ab_lab_s7_teste_nativo.sql` aplicada em produção [PROD, `schema_migrations`]; a flag **está ligada** em produção (resolvido, M2: `registro_teste_nativo` rodou 49× em 48 h, status ok [PROD]).
- **Dois portões separados (D11).** (a) **O marcador é sempre aceito**; se há teste nosso ativo no vídeo, dispara a pausa sem escrever, porque escrever durante o nativo cancela o teste. **Isto é código novo na função mais crítica, não reaproveitamento (I1):** `MotivoSaida` (`ab-settle.ts:22`) não tem `teste_youtube`, `ab-restore.ts:7` trata `pulado_teste_youtube` como só leitura e `pausa` hoje (`actions.ts:727`) **restaura o original**, isto é, escreve. A F1a é declarada como mudança em `settleOnAir`: motivo novo `teste_youtube`, `estado: 'pulado_teste_youtube'` **definitivo** (`camposPendentes` só devolve `falhou`/`desistiu`, então o vigia não tenta de novo), com **curto-circuito** (Yannis I2): logo depois de normalizar o destino e **antes** de `resolverAcesso`, `if (op.motivo === 'teste_youtube') return gravarPuladoDefinitivo(...)`, um `update` com CAS por `restore_seq` que põe `status='paused'`, `paused_at` e `restore_status` dos campos de `camposDoTeste(test_type)` com `{estado:'pulado_teste_youtube', escreveu:false}`, sem token, sem fetch, sem escrita (`OpcoesSaida.destino` é ignorado nesse motivo). Sem curto-circuito, token vencido viraria `falhou/token`, contrariando o definitivo. Sem isso, o restore pendente reescreveria o original **por cima do vencedor do YouTube** quando o marcador vencer ou o dono responder. Testes: zero `fetch`/token no motivo novo (portas que lançam se chamadas); `seqEsperado` velho → `mudou`; restore `em_andamento` recente → `em_andamento`; com B no ar; depois do pulado, "Encerrar com o original" com título atual diferente cai em `precisa_confirmar`; `camposPendentes('vigia')` devolve `[]` para o pulado. A ficha avisa "No Studio, o 'original' será o que está no ar agora: {variante}", e na resposta do dia 14 "Restaurar o original" só aparece como escolha explícita do dono. (b) A ordem pausar → restaurar o original → confirmar no YouTube que voltou (`sonda-step.ts`, `variante_vista`; `destinoDosCampos`) vale só para **habilitar "Abrir no Studio"** quando o marcador ainda não existe. Teste: com teste nosso `active` e restore pendente, `confirmarTesteNoStudio` grava o registro `confirmado`, deixa o nosso `paused` com `pulado_teste_youtube` e **zero escrita no YouTube** (mock da Data API sem `update`).
- **Validade e fechamento (Yannis B4):** início = `inicioDoTeste(row) = coalesce(confirmado_em, primeira_vista, created_at)` (função pura). Prazo = `RULES.testCompareMaxDays` (14) mais margem nomeada de 2 dias, sem coluna; emenda à S6 §6.5 (hoje 30 dias). O registrador (S7, `registro/registrar.ts:103-125`) encerra linhas `em_andamento` sozinho, e o marcador de miniatura ele não enxerga; por isso `avisos_pendentes` fecha, uma vez por linha, com o CAS por `updated_at` do registrador: `estado='sem_desfecho', desfecho_estado='sem_dado', desfecho_motivo='sem_resposta', encerrado_em=now() where estado='em_andamento' and origem='confirmado' and inicio + 14 d + 2 d <= now()`. Sem isso o índice `ab_native_tests_um_aberto` e a recusa do `start` bloqueariam o nosso para sempre.
- **Guarda barata em três pontos (Yannis I3):** função pura `bloqueadoPorTesteNativo(videoIds): Map<videoId, linha>`, **uma** consulta em lote (`estado='em_andamento' and video_id in (...)`, `ler.ts:280`), usada em `startAbTest`, `retomarTeste` (`ab-resume.ts:93`) e antes do laço de `phaseRotateActiveTests` (`ab-rotate-phases.ts:224`, sem N+1). Na rotação: teste com linha aberta **pula a escrita** e grava `status_note`; se a linha é `detectado`, dispara `settleOnAir(teste_youtube)`. Testes: retomar com linha aberta recusa com motivo; rotação com `detectado` → zero escrita e `paused/pulado_teste_youtube`; uma consulta para N testes.
- **Janela de corrida (F1a):** se o cron já reivindicou a rotação (`ab_settle_claim`) quando o marcador entra, a escrita sai em até 1 ciclo; a ficha diz "pause o teste antes; o botão só libera depois". A guarda dentro da reivindicação (antes do `claim`) é F1b.

### 5.3 Ficha "Testar no YouTube"

- Até 3 variantes (título e/ou thumbnail), "Copiar título" e "Baixar imagem" por variante, thumbnail sempre em 1280×720 (abaixo disso o Studio reduz tudo a 854×480 [P]); reaproveita a regra 1280 da T1 do plano "original em alta".
- "Abrir no Studio" abre a página do vídeo. No celular: "No computador" e "Lembrar no computador" (o teste nativo é só desktop [P]).
- "Já iniciei" grava o marcador (para título, a S7 também detecta sozinha). Ao abrir qualquer ação do nosso num vídeo com ficha enviada nos últimos 14 dias sem marcador, pergunta "Você iniciou no Studio?".
- **Lembrete no dia 14** (notificação mais selo na linha e na lista; gerado por `avisos_pendentes` pelo outbox de §3.4: coluna `lembrete_notificado_em` e as de tentativas em `ab_native_tests`; dispara para linha `em_andamento` **ou** encerrada sem `resposta_dono`, com `inicioDoTeste + RULES.testCompareMaxDays <= hoje`): "Venceu a nova", "Ficou igual", "Inconclusivo", "Não vi". **Resposta aditiva (Yannis B4):** a ação do dono (server action com `requireSiteAdmin(siteId)` no topo e `getSupabaseServiceClient()` só depois de `canAdminSite`; a tabela revoga `update` de `authenticated`) **sempre** grava `resposta_dono`, `respondido_em` e `variante_vencedora`; só toca `estado`, `desfecho_*`, `vencedor_*` e `encerrado_em` (exigido pelo CHECK) se a linha ainda está `em_andamento`, com `update ... where id = :id and estado = 'em_andamento' and updated_at = :lido`; se o CAS perde, relê e grava só a resposta. Se o registrador já encerrou com `vencedor_fonte = 'data_api'` e o dono diz outra coisa, **guardam-se as duas** e a tela mostra "o YouTube indicou X; você disse Y". **Mapeamento exato em `ab_native_tests`** (valores existentes: `estado ∈ {em_andamento, encerrado, sem_desfecho, descartado}`, `desfecho_estado ∈ {vencedor_provavel, em_andamento, sem_dado}`, `vencedor_fonte ∈ {regra, dono, data_api}`):

| Botão | `estado` | `desfecho_estado` | outros |
|---|---|---|---|
| Venceu a nova | `encerrado` | `vencedor_provavel` | `vencedor_fonte = 'dono'`, `variante_vencedora` (`n` da variante, ver migration), `resposta_dono = 'venceu_nova'`; `vencedor_titulo` quando houver título |
| Ficou igual | `encerrado` | `sem_dado` | `resposta_dono = 'ficou_igual'` |
| Inconclusivo | `encerrado` | `sem_dado` | `resposta_dono = 'inconclusivo'` |
| Não vi / sem resposta | `sem_desfecho` | `sem_dado` | `resposta_dono = 'nao_vi'` ou `'sem_resposta'`; nunca vencedor |

  **Migration** (r3: **não é só aditiva**, M4): `lembrete_notificado_em timestamptz`, `resposta_dono text check in ('venceu_nova','ficou_igual','inconclusivo','nao_vi','sem_resposta')` `variante_vencedora smallint`, `respondido_em timestamptz`, `notificacao_tentativas smallint not null default 0`, `notificacao_falhou_em timestamptz` e `variantes jsonb` (array de `{n, tipo, titulo?, asset_id?}`, `n=1` é o original, gravado no "Já iniciei" a partir da ficha; com mais de 2 variantes o dia 14 pergunta "Qual?" com miniaturas; a ação recusa `n` fora do array; Yannis I6); o CHECK atual de vencedor, que em produção se chama `ab_native_tests_check3` e não tem nome no arquivo, é trocado por `drop constraint ab_native_tests_check3` **explícito** (um `drop ... if exists` por palpite não faria nada e o CHECK velho continuaria recusando "Venceu a nova" só de miniatura); o novo CHECK tem nome e aceita `variante_vencedora` no lugar de `vencedor_titulo`. "Inconclusivo" e "Ficou igual" aparecem como "sem dado", não "empate". Testes: um caso por botão grava a linha esperada; ficha com 3 variantes → resposta `n=3` grava e `n=4` recusa; registrador fecha antes do dia 14 → o lembrete ainda sai; dono e registrador escrevendo juntos → uma linha consistente, nunca vencedor sem fonte; marcador sem resposta no dia 17 → `sem_desfecho/sem_resposta` e o `start` do nosso passa a ser aceito; usuário sem permissão recusado; "Venceu a nova" só de miniatura passa no CHECK; vencedor sem fonte é recusado; erro de escrita não é engolido (o lembrete não pode ficar para sempre).

### 5.4 Portão de volume (D10)

Vale para os dois caminhos em vídeo com ≥ 7 dias. A ação mostra impressões/dia e dias até o piso; abaixo, "Sem volume para teste. Trocar direto?". Piso e conta: Phil (~1.540 impressões por variante para ganho de 50%, CTR base suposto, parecer nativo × nosso §4).

### 5.5 O nosso só como indício

Placar diz "mais views/dia até agora, indício por tempo alternado"; nunca "vencedor" abaixo do piso. Mesmo nome em todas as telas e no Cowork.

### 5.6 Roteiro (`docs/superpowers/plans/2026-10-14-ab-lab-roteiro-e-horas.md`): o que muda, sem renumerar

- 14 (P4b) e 15 (Migration B): sem mudança de escopo; reconfirmar que nenhuma tabela nova depende da Migration B.
- 16 (medição nova): sai do caminho crítico; vira rótulo "indício" e piso. Gatilho: algum vídeo passar de ~110 impressões/dia.
- 17 ("Candidatos a teste"): absorvido pela lista única de Sugestões (§6).
- 18 (telas do A/B): encolhe ao que o nosso caminho precisa (placar "indício", lote).
- 19 (nativo × nosso): fecha com a regra de §5.1.
- 20 e 21 (detecção, S6 a S9): continuam; a S6 fase 2 (guarda completa) vira **F1b**.

### 5.7 "Original em alta" (D12, decidido)

Fica: T1 (regra única 1280, testes de fronteira 1279/1280) e um aviso antes de iniciar, sem migration nem envio de arquivo. Congela: T2 a T18. Gatilho de descongelar: o dono rodar o primeiro teste nosso em vídeo longo com ≥ 28 dias e perder a original em alta, ou Short/kids recusado de verdade por original baixa. **Risco a sondar antes de qualquer descongelo:** a guarda de início da T11 pode **bloquear Shorts** cuja imagem vertical não tem `maxres` 1280, e Short é o uso principal do nosso; sonda em 2 Shorts reais (Gio ou Phil). Registrar no roteiro como subnúmero de 21.

## 6. Telas (direção; o desenho final e o nome do botão saem do mockup, D13)

- **Lista única "Sugestões (N)"** (nome provisório), aberta por um botão com contador em Competidores e por um bloco no A/B Lab que **substitui** o cartão "Sugeridos para testar" (`ab-lab-dashboard.tsx:346` em `origin/main`). Mesmo estado nos dois: dispensar ou fazer num lugar some no outro.
- Linha: chip de origem com símbolo (meu vídeo caiu / concorrente bombou / destino esquentou / candidato), miniatura e título, frase-motivo com o número, régua contra a mediana, um botão primário que diz o que acontece; dispensar é secundário, com motivo de um toque ("não é para mim", "já tratei", "depois", que volta em 7 dias via `adiado_ate`). Até 5 visíveis, "ver todas (N)".
- Selo de estado por vídeo no A/B Lab: "Em teste no Studio", "Teste nosso rodando", "Resultado do YouTube pronto", "Sem volume"; "não medido" em cinza próprio, nunca 0.
- **Notificação do sistema mais lembrete visual nos dois lugares** (D14); o lembrete do dia 14 vive também na linha do vídeo.
- **Estado vazio do canal novo ou parado:** vazio por tipo, com motivo e régua de progresso; as sugestões de terceiros já aparecem. Carregando: N como "…", nunca 0. Erro: mantém a última lista boa com "desatualizado" (`computed_at`).
- Um componente de cartão para todas as variantes; eyebrow com ≥ 12 px (o atual tem 9 px); só tokens `--cms-*`; cor de carga estrutural em `rgba`/hex, nunca `color-mix()`.

## 7. Fases de entrega (ASAP) e paralelismo com a A5

A A5 sobe para staging em 21/10 e é **promovida sozinha em 22/10** (recado do dono); em 23/10 a promoção do dia é da A5 (T9 da E19), então o A/B combina antes de usar. **Regra verificável (Yannis I5), no lugar da exceção "se a A5 não tiver o arquivo aberto":** nenhuma edição em `coleta/index.ts`, `reports-step.ts`, `agenda/definicoes.ts`, `observatorio/outliers.ts`, `fila-relatorios.ts`, `diario-step.ts`, `criteria.ts` e `sync-analytics-metrics/route.ts` até `git log origin/main -1 -- <arquivo>` mostrar o commit da A5 (promoção de 22/10 confirmada); no mesmo dia refazer os `git grep` da §2 e atualizar as linhas (os números de linha da §2 valem para `main`, não para o que a A5 reescreve). Pode andar hoje sem tocá-los: migrations, `lugares`/`lugar_aliases`/`video_lugares`, núcleo puro, `niche_signals` e a função de gravação, ficha e marcador. Ressalva: um ajuste pequeno da A5 em `versoes-step.ts` (teto da E11) pode ir num push seguinte, com aviso.

**Ordem (r3, I6):** o canal próprio está a ~0,5 view/dia, então "meu vídeo caiu", o portão de volume, a medida de D2 e o chip "candidato" dão `nao_medido` por semanas; o único valor imediato é cruzar o nicho com o acervo pelo lugar (F2). Logo **F2 (com o lugar determinístico) sobe e roda em paralelo com F0-a e F0-b**; depois F1a, F2b, F3 e F4. A F2 sai primeiro como leitura MCP (valor para o dono via Cowork); a tela vem na F3.

| Fase | Conteúdo | Valor | Aceite | Paralelo com a A5? |
|---|---|---|---|---|
| **F0 Coleta** | F0-a a F0-e, C4, C6, T3; tabela de eventos vazia e função de leitura (contrato fixo) | nenhum dado se perde a partir da implantação | Phil roda leitura em produção: para **cada** canal próprio conectado (token válido), inclusive os parados e o sem vídeos, jobs `ativo` dos 13 tipos e, no D+3, linha de coleta **ou motivo** (`sem_videos`); por canal, relatório `channel_traffic_source_a3` `baixado`/`vazio` com `end_time >= hoje − 4` (I3); teste apaga cada flag/variável nova e afirma o padrão (a rota parcial não cria variável: o teste dela é "sem `?passos` = hoje"); por canal conectado, relatório recente dos 13 tipos esperados, não só jobs; canal com token válido e `sync_enabled=false` gera ação do dono e falha. Sem `topicDetails` no aceite (M2) | **Agora:** plano da F0, migrations (`db:new` em árvore em dia), visão de termos (F0-e), C6 sem código. **Depois da promoção da A5 (regra acima):** F0-a, F0-b, F0-c, F0-d |
| **F2 Sinal via Cowork** (sobe, I6) | tabelas `lugares` e `niche_signals`, núcleo puro, lugar v0 determinístico (T2), tarefas `sinais_do_nicho` e `avisos_pendentes` na agenda (depois do script de custo, I4; padrão `pesada`), "vídeo parecido bombou" e "destino esquentou" em `pais:` primeiro, outbox e notificação por `createNotification`, ação MCP | o dono pergunta ao Cowork "o que bombou no nicho e eu não tenho?" já na 1ª semana | Cowork e rota devolvem a mesma lista e o mesmo N; cada linha cita número e versão da regra; teste apaga o histórico e afirma o `motivoVazio` (inclui `sync-atrasado`); reexecução não duplica evento nem reabre dispensado; notificação aparece no que o **sino** lê e some quando se dispensa; portão de precisão do lugar ≥ 90% (T2); `OBS_SINAIS_NICHO` apagada desliga a tarefa (`catalogo.test.ts`; linha em `docs/ops/env-vars.md`, M5 do Yannis); p95 da tarefa < 225 s | **Agora:** núcleo, `lugares`, tabela, função de gravação, migrations (antes do código que grava). **Depois da promoção da A5:** `agenda/definicoes.ts` |
| **F1a Ficha e marcador** (sem portão) | ficha "Testar no YouTube", marcador "Já iniciei" sempre aceito + **pausa sem escrever como mudança em `settleOnAir`** (D11, I1), lembrete do dia 14 com 4 botões e outbox (§5.3, migration com `drop constraint ab_native_tests_check3`), portão de volume ≥ 7 dias e rótulo "indício", T1 + aviso (D12), linha "nativo indisponível → nosso" (I7), recusa no `start`, no `retomar` e na rotação do teste nosso quando há `ab_native_tests` `em_andamento` no vídeo (`bloqueadoPorTesteNativo`, uma consulta em lote, §5.2; sem `avaliarGuarda`), fechamento do marcador vencido e resposta aditiva (B4) | o lançamento de novembro sai no nativo sem o nosso pisar nele, sem esperar portão | `start` do nosso com registro aberto → recusa com motivo; sem registro → segue; marcador com teste nosso ativo pausa sem escrita (fronteiras: B no ar, restore `em_andamento`, `seq` velho); um teste por botão; "Venceu a nova" só de miniatura passa no CHECK; ficha leva 1280×720 (Gio no Opera); no dia 14 o lembrete sai (e sai no dia seguinte se o envio falhar) | **sim**: `ab-lab/` e `teste-youtube/`, fora do território da A5 (a mudança em `settleOnAir` não é da A5) |
| **F1b Guarda completa** | `avaliarGuarda` da S6 fase 2, guarda dentro da reivindicação (M6), portões C-17 e C-17b | o nosso nunca escreve durante o nativo mesmo sem "Já iniciei" | portões da S6 | depende do teste nosso girar (C-17b exige ≥ 3 rotações); **não bloqueia o lançamento**; antes do primeiro teste nosso em vídeo com T&C |
| **F2b Medida de D2** (nova, B3) | `niche_signal_efeitos`, janela gravada, estimador com controle (§3.6), leitura de `RELATED_VIDEO` (C4) | guardar a janela hoje; medir quando houver dado | aceite de §3.6 (testes com literais; nada na tela antes do gatilho; "associação, não causa") | só **coleta** até o gatilho de §3.6 (≥ 10 eventos, Σpré ≥ 30, idade do dado); depende de F0-a e de eventos com `pub + 34` |
| **F3 Tela única** | lista "Sugestões (N)" nos dois lugares, notificação na transição | decisão em 3 segundos sem abrir o Cowork | mockup aprovado (Logan, Naksu, dono); N igual em Competidores, A/B Lab e Cowork; dispensar num lugar derruba o N no outro; canal vazio mostra motivo e régua | depois do mockup |
| **F4 Depende de dado** | thumbnail com referência condicionada ao `RELATED_VIDEO`; título complementar pela forja (top-K); forja propõe aliases de lugar; "meu vídeo caiu" com portão | ações mais caras só com evidência | cartão mostra "já recebo tráfego dele: sim/não/não medido"; título gerado não afirma número fora do contexto congelado | — |

Caminho crítico até o dono sentir valor: **F2 ∥ F0-a/F0-b → F1a (o dia 14 do 1º vídeo novo cai em dezembro) → F2b → F3.** **Ordem obrigatória:** migration antes do código que grava; `OBS_SINAIS_NICHO` no Vercel antes do deploy que a lê (desligada por padrão; teste que apaga a variável). Orçamento de builds (≤ 3 pushes/dia/terminal até 27/10): F0 e F1a cabem numa promoção combinada só se revisados até a véspera.

## 8. Riscos, incluindo falhar em verde

| Sinal ou peça | O que acontece quando o dado não existe? | Resposta do desenho |
|---|---|---|
| "Destino esquentou" | outlier sem `lugar` (forja fora ou atrasada) gera zero eventos com cara de "nada esquentou" | `nao_medido` com motivo `sem-lugar`/`forja-fora`; contagem de outliers sem lugar visível |
| "Destino esquentou" | canal com poucos vídeos: razão enorme por mediana minúscula | n mínimo (vídeos com `vpd7` no formato) e piso absoluto; abaixo, `nao_medido` |
| Medida de D2 | canal nosso sem base nos -28 dias ou < 3 views/dia | `nao_medido: volume`/`base_zero`/`cobertura`; antes do gatilho nada na tela (§3.6); nunca "sem efeito" |
| "Meu vídeo caiu" | canal novo ou parado sem mediana própria | mediana do nicho, declarada no motivo; sem nenhuma, `sem-historico` |
| Contador | gravador falhou e a tabela ficou velha | `expires_at` filtrado na leitura; tela mostra `computed_at` e "desatualizado"; vermelho da agenda |
| `RELATED_VIDEO` | detalhe abaixo do limiar vem vazio (`detail = ''`) ou chega com atraso | "sem detalhe" ≠ "não recebo tráfego"; três estados sim / não / não medido; fila corrigida (F0-a) |
| Marcador | dono esquece "Já iniciei" num teste só de miniatura | a guarda libera (furo declarado na S6 §6.6); mitigação: "Você iniciou no Studio?"; F1b fecha |
| Resultado do nativo | dono não registra | `sem_desfecho` + `sem_resposta`, nunca vencedor |
| Coleta F0 | canal parado, com `sync_enabled = false` ou sem vídeos, pulado e nenhuma linha gravada: parece "canal sem dado" | invariante conectado ⇒ `sync_enabled = true` (B2); `sem_videos`; aceite exige linha **ou motivo** por canal |
| Cron parcial | execução parcial limpa mascara o ciclo completo vermelho | veredito sob nome próprio, sem `parteAntiga` (§2.3 F0-c) |
| Lembrete e outbox | F2 desligada impede o lembrete; notificação que falha sempre repete | tarefa `avisos_pendentes` separada; teto de 3 tentativas e vermelho (§3.4) |
| Fila da Reporting | canal novo triplica a demanda e o corrente vence sem download | F0-c antes do canal novo; conferência `listado` > 7 dias = 0 |
| Playlists | ligar os 6 tipos estoura a fila e perde histórico | só com `listado` < 60 (C6) |
| Bruto da Reporting | comentário do código diz "apagado em 180 dias" | corrigido; teste afirma `purge = 0` |
| Lugar | forja nunca produziu leitura; slug escolhido por LLM varia entre "Phu Quoc" e "Đảo Phú Quốc" | lugar v0 por texto + `lugares` (T2); `recordingDetails` só confirma; forja só propõe |
| Notificação | passa no banco e o dono nunca a vê | `notifications` (a que o sino lê) + teste que lê o que o sino lê; outbox (§3.5) |
| Pausa do nosso | restore pendente reescreve o original por cima do vencedor do nativo | `teste_youtube` definitivo em `settleOnAir` (§5.2) |
| Medida de D2 | janela começa depois do efeito; estação confundida com efeito | âncora na publicação, controle e placebo (§3.6) |
| Cópia | thumbnail de terceiro está no Blob com URL pública (A5 §13) [P] | referência só dentro de `can_view_site`; evidência guarda id, não a imagem |

## 9. Perguntas abertas ao dono

Nenhuma decisão do dono foi contrariada pelos consertos da r3 (§13). Uma **tarefa de conferência** dele, hoje (I7): em Studio → Configurações → Canal → Qualificação de recursos, no canal novo, ver se "recursos avançados" (Test & Compare) está disponível. Se não estiver, a linha "nativo indisponível → nosso, rotulado indício" (§5.1) vale para o lançamento de novembro.

## 10. Fora de escopo (com gatilho de retomada)

| Item | Gatilho |
|---|---|
| Embedding de miniatura e "parecido" semântico | mais da metade das dispensas em 30 dias for "não é parecido" ou "lugar diferente" |
| Momento de publicar (mapa E15) | canal novo com vídeos suficientes para mapa próprio (n pelo Phil) |
| Push e e-mail de sugestão | o dono disser que perdeu uma sugestão, ou antes da viagem de jan/2027 |
| Integração com API do teste nativo | surgir API pública; aí a leitura troca o marcador manual |
| Busca anônima pela forja (posição do nosso vídeo por termo) | F2 no ar e termos de destino definidos; conferir os termos de uso antes |
| Google Trends | API sair do alpha fechado |
| Termos de busca semanais pela Analytics (era C3) | a visão sobre R5 ficar vazia em mais de X% das semanas por `detail = ''` (X pelo Phil) |
| Original em alta T2 a T18 | gatilho de §5.7 |
| Limpar `yt_own_video_daily_zeros_bkp` (24 MB, 17% do banco) | registrar no BACKLOG com data de descarte |

## 11. A conferir antes do plano

- **Toda referência de código é de `origin/main` (b04049787, reconferido na r4: sino filtra `dismissed_at/expired_at/read_at`, `fanOutToSiteAdminsDetailed` existe, última migration `20261021000001`); o checkout local (`staging` 5e581375b, 231 arquivos atrás em `lib/youtube`) não serve.**
- **Resolvidos (M2):** `AB_NATIVO_REGISTRO` está ligada; `topicDetails` já é gravado em `competitor_raw`; o CHECK de `yt_notifications` não mudou e deixou de importar (B1).
- Dono: "recursos avançados" no canal novo (§9, I7).
- Script de custo do gravador, por etapa e projetado a 365 dias (§3.4), antes do plano da F2.
- Vercel aceita duas entradas de cron com o mesmo `path` e `query` diferente (F0-c; plano B: rota irmã).
- Mapeamento dos códigos 4 e 5 de `traffic_source_type` para BROWSE/RELATED/SEARCH (F2b).
- Retenção da Reporting no Google hoje (60 × 180 dias) e se algum `check` de `outcome` aceita `sem_videos`.
- Contagem de canais com n ≥ 8 pelo critério novo (§3.1) em produção.
- Docs: linha em `docs/ops/env-vars.md` para `OBS_SINAIS_NICHO`; teste que apaga a variável; medir o p95 do gravador a frio e adotar `leve` só se < 40 s (Yannis M3).
- Semente de `lugares` e `lugar_aliases` (países e ~100 destinos, aliases ambíguos marcados) (T2).

## 12. Decisões da r2 (divergências entre Phil e Yannis, e como os achados foram aplicados)

Critério: o menor custo que não abre buraco. Todos os achados da r1 foram aplicados (Phil B1–B4, I1–I9, M1–M6; Yannis B1–B3, I1–I8, M1–M6); abaixo só o que exigiu escolha.

| # | Divergência / ponto | Decisão | Motivo |
|---|---|---|---|
| R1 | Yannis I3: canal sem `sync_enabled` fica sem job. Phil R14: os 2 canais têm 13 jobs `ativo` em produção | **Os dois estão certos.** Fato [PROD]: hoje os 2 têm `sync_enabled = true` e 13 jobs. Código [V]: o filtro `sync_enabled` existe (`coleta/index.ts:176`). Regra: jobs para todo próprio conectado, independentemente da flag, mais o critério de saúde que acusa canal sem job | job da Reporting não gasta cota; a regra fecha o buraco futuro sem mudar o presente |
| R2 | C1: Yannis M5 (tirar tipos da lista do purge) × Phil M1 (purge já devolve 0) | Nada a coletar nem mudar na lista; corrigir o comentário (o teste `purge = 0` já existe, r3 M3) | o dono quer sem prazo e já é assim; mexer na lista seria trabalho para um efeito que não existe |
| R3 | C3: Yannis (visão SQL sobre R5, zero job) × Phil (Analytics 1×/semana com janela) | **Visão SQL sobre R5.** Analytics semanal só pelo gatilho de §10 | custo zero e dado não expira; a r1 de ambos concorda que não há perda por esperar |
| R4 | C2: ambos tiram do diário. Tabela: Phil (mesma tabela com `source = 'analytics'`) | Phil, só na janela de evento, ≤ 20/dia | reaproveita a chave existente; a Reporting sobrescreve |
| R5 | Evento: Yannis (`window_key` = lugar + data, upsert condicional, `adiado_ate`) × Phil (índice único parcial `aberto`, insert + update) | Índice único parcial **e** `adiado_ate`; expirar na mesma execução do gravador + filtro na leitura | sem balde de data, nada para ficar ambíguo; Yannis M3 respeitado (nenhum job de expiração) |
| R6 | Piso absoluto: Yannis (`v.views` do `ObsVideo`) × Phil (marca D7, senão `vpd7 × 7`) | `vpd7 × 7` do mesmo `ObsVideo`, fonte no motivo | uma só fonte; as marcas só cobrem 1 canal com n ≥ 8 |
| R7 | Resultado do nativo: Yannis (`vencedor_miniatura jsonb`, `desfecho_motivo`) × Phil (`resposta_dono`, `variante_vencedora`, `valido_ate`) | Phil nas duas colunas (distingue botões no banco; vale para título e miniatura); validade por **constante** (Yannis), sem `valido_ate` | menos colunas e sem jsonb solto |
| R8 | Quando roda o gravador: Phil (1×/dia e de novo quando chega `lugar`) × Yannis (1×/dia) | 1×/dia | reexecutar o motor por causa de um `lugar` custa mais que esperar até o dia seguinte; ASAP continua atendido porque o evento vale 30 dias |
| R9 | Capacidade: Phil (rota nova 3×/dia ou execução repetida) | repetir a execução às 00 UTC **com `?passos=` validado** (r3 I2: só `vercel.json` dobraria a cota) | triplicar com rota nova é código a mais; começa pelo mínimo e mede |
| R10 | F1: Yannis (F1a sem portão + F1b) | adotado | evita travar o lançamento num portão que pode nunca fechar |
| R11 | Timing do `fila-relatorios.ts` (Phil: entra já; Yannis: arquivos da A5 esperam) | entra já só se a A5 não tiver o arquivo aberto; senão depois da promoção da A5 de 22/10 (r3) | evita conflito de edição com a A5 a 100% |

**Sem conserto nesta rodada:** piso exato, parâmetros do "meu vídeo caiu" e X de §10 (Phil, no plano); retenção da Reporting no Google; data em que os vídeos passam de ~100/dia (estimativa).

## 13. Decisões da r3 (revisão adversarial da r2, 55/100)

Todos os achados foram aplicados; nenhum contradisse decisão do dono (D1–D19), então não há pergunta nova. Só o que exigiu escolha ou tem motivo próprio:

| Achado | Decisão | Motivo |
|---|---|---|
| B1 | Notificação por `createNotification`/`notifications`, tipo `youtube.niche_signal`; fora a migration do CHECK de `yt_notifications`, a união `NotificationType` e `expire-notifications` | `yt_notifications` está morta (última linha 18/05); o aceite antigo passava em verde com o sino vazio |
| B2 | Lugar v0 determinístico (`recordingDetails` + tabela `lugares`); forja só propõe aliases (F4) | `competitor_readings` = 0 linhas e a forja nunca produziu `temas`; escrita na forja é do dono |
| B3 | D2 vira a fase F2b, com `niche_signal_efeitos`, âncora em `published_at`, conta fechada em +34, impressões antes de views, estimador agregado com controle e placebo de 1 e 2 anos | a janela da r2 já continha o efeito; vídeo antigo e pequeno era excluído por construção; sazonalidade confundia |
| I1 | Pausa sem escrever = mudança em `settleOnAir` (`teste_youtube`, `pulado_teste_youtube` definitivo), com testes de fronteira | o código não tem esse motivo e `pausa` hoje escreve; sem isso o restore sobrescreve o vencedor do nativo |
| I2 | F0-c ganha `?passos=` validado por Zod | a rota não tem modo parcial; repetir dobra a cota |
| I3 | Causa dos 16 dias corrigida (ordem por vencimento); aceite por canal | o aceite por `max(day_pt)` não depende da coleta num canal de ~0,5 view/dia |
| I4 | Medir o custo do gravador antes do plano; `leve` se < 50 s, senão `pesada` cedendo a `sincronizar_canais` | nenhuma tarefa monta o observatório inteiro hoje; `sincronizar_canais` já passa de 190 s |
| I5 | Outbox (`notificado_em`, `lembrete_notificado_em`) na tarefa diária | notificação e lembrete do dia 14 se perdiam em silêncio |
| I6 | F2 sobe e roda ∥ F0-a/F0-b; dívida de `outliers.ts` vira item próprio; F2 sai como leitura MCP | só a F2 dá valor na 1ª semana; os dois itens eram dispensáveis |
| I7 | Linha "nativo indisponível → nosso" e conferência do dono hoje | canal novo pode não ter Test & Compare |
| I8 | Régua por formato (ou "só longos" declarado) e `motivoVazio: 'sync-atrasado'` | `fmt: 'long'` é o padrão e `sem-ritmo` some com os outliers |
| M1–M7 | M1 ≤ 7 dias → nativo sem portão; M2 itens resolvidos; M3 só o comentário; M4 `drop constraint ab_native_tests_check3` explícito; M5 `RULES.testCompareMaxDays` + margem; M6 "conectado" = token válido; M7 `subject_key` do "meu vídeo caiu" = id do vídeo próprio | conforme a revisão |
| Calendário | "push de 24/10" vira "promoção da A5 de 22/10"; aviso do ajuste da A5 em `versoes-step.ts` e da promoção de 23/10 | recado do dono de 21/10 ~15:15 UTC |

## 14. Decisões da r4 (re-revisão da r3: Yannis 80/100, Phil 82/100)

Todos os achados foram aplicados com o conserto de cada revisor; nenhum contradisse D1–D19, então não há pergunta nova ao dono. Onde divergiram, o menor custo que não abre buraco:

| Ponto | Decisão | Motivo |
|---|---|---|
| Canal parado (Yannis B2 × r2 R1: job sem `sync_enabled`) | Invariante "conectado ⇒ `sync_enabled = true`" mais critério de ação do dono; revoga a regra R1 da r2 | um invariante em vez de dez filtros; job sem download seria perda silenciosa |
| Lugar (Phil A1: sem GeoJSON, texto × Yannis I7: polígono, tabela de lugar) | Phil na conversão (sem polígono; `recordingDetails` só confirma); Yannis no armazenamento (`video_lugares`) e no índice de n-gramas | polígono é peso para 29% de cobertura, 34% dela viciada; sem tabela cada dia releria 21 MB |
| Tarefas (Yannis B3: 2 × Phil M7: 3) | Duas, `sinais_do_nicho` e `avisos_pendentes`; a F2b roda em passos isolados na primeira | isola o lembrete da F2 (o bloqueio real) sem uma terceira linha na agenda |
| Tentativas do outbox (B3 e A9) | `fanOutToSiteAdminsDetailed`, marca com `total > 0 && errors.length === 0`, 3 tentativas, depois vermelho | uma regra só para as duas pontas |
| Sino (Phil A4) | Marcar `notifications.expired_at` no gravador e na ação, sem mudar o leitor | reaproveita o filtro que já existe |
| `leve` × `pesada` (Phil A8 × Yannis M3) | Padrão `pesada`; `leve` só com p95 projetado a 365 d ≤ 10 s | a agenda não garante partida antes de 35 s |
| Tabela da F2b (Phil A7: par × M4: agregado) | Unidade = outlier, linhas agregadas por métrica e papel | mantém a âncora imutável e < 1 MB/ano |
| F2b (Phil A5–A6; pedido do dono: não inventar placebo) | Só coleta até ≥ 10 eventos, Σpré ≥ 30 e idade do dado; placebo anual só em views totais; impressões só a partir de ~08/09/2027 | com ~4,8 impressões/dia e sem passado, qualquer número seria falsa precisão |
| Calendário (Yannis I5) | Regra por `git log origin/main` dos arquivos da A5, não "se a A5 não abriu" | verificável |
| `db:new` (Yannis I9) | Primeira tarefa do plano: árvore em dia com `origin/staging` | o script só enxerga as migrations locais |
| Menores | M1 (< 7 d lançamento), janela −28 em C4, `rule_version` com a semente, canais distintos no evento, 1ª execução em resumo, `channels` sem e-mail, ciclo de 30 d intencional | conforme as revisões |
