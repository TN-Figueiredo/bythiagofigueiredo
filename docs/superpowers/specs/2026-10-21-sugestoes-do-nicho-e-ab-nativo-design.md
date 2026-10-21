# Spec: sugestões a partir do nicho e A/B com o teste nativo como caminho principal

- **Data:** 21/10/2026. **Estado:** 1º rascunho (Opus), para a revisão de Phil e Yannis e, nas telas, de Logan e Naksu.
- **Libera (quando Phil e Yannis concordarem):** escrever o plano da fase F0 (coleta). **Não libera:** código, migration, mockup aprovado, deploy.
- **Fontes:** `.superpowers/sdd/ab-lab/sugestoes-de-teste-discussao/` (decisões do dono de 21/10, planos e pareceres de Hanna, Phil, Yannis, Logan e Naksu, parecer do Phil sobre o algoritmo, replanejamento do A/B) e `../nativo-vs-nosso-recomendacao/parecer-phil.md`.
- **Legenda:** [V] conferido no código ou na migration hoje (caminho citado); [P] afirmado por um parecer e não reconferido por mim; [a conferir] dúvida aberta que o plano resolve antes de construir.

## 0. Problema e objetivo

Hoje o sistema só olha para o sucesso dos vídeos do próprio dono e o A/B Lab trata o nosso teste (rotação por tempo) como caminho principal. Dois fatos mudaram isso:

1. **O sucesso do nicho é o sinal mais rico que temos.** O observatório (A5) já coleta quase tudo dos canais de terceiros, mas a leitura é manual (tela de Outliers). A hipótese principal do dono: quando um vídeo grande sobre um destino bomba, o YouTube passa a recomendar outros vídeos daquele destino, inclusive os antigos e menores do dono. A experiência dele (Vietnã, vietnamita: uns 10 canais diferentes recomendados depois de assistir a um) indica recomendação por tema **forte**. O parecer do Phil não achou prova oficial nem estudo controlado: o mecanismo é plausível (Sugeridos e Busca), não provado. **O spec trata o sinal por destino como hipótese principal a medir**, não como aposta fraca, e mede com o dado dos canais do dono.
2. **O teste nativo do YouTube (Test & Compare) é melhor que o nosso onde ele roda e há volume:** divide o público ao mesmo tempo e mede tempo assistido. O nosso mede por tempo alternado, com viés de dia e de idade [P, parecer nativo × nosso §2].

**Objetivo:** transformar o sucesso do nicho em ação concreta e barata no acervo e na pauta do dono, a partir de uma fonte única de sinais lida pela tela, pelo contador e pelo Cowork; e fazer do teste nativo o caminho principal de teste, com o nosso como exceção que só dá **indício**. A coleta vem antes de tudo, porque dado que a origem expira não volta.

## 1. Decisões

| # | Decisão | Motivo | Fonte |
|---|---|---|---|
| D1 | ASAP: entregar o mais cedo possível; a data dos canais novos (fim de nov a 07/12) é estimativa e não é folga | pedido do dono | decisões 21/10 12:10 |
| D2 | Sinal por destino ("destino esquentou") é a hipótese principal, medida com o nosso dado; texto da tela "pode ajudar", nunca "vai ajudar" | experiência do dono pesa; não há prova oficial | decisões 21/10; parecer Phil algoritmo §5.5 |
| D3 | Coleta máxima em **todos** os canais próprios (novos, antigos e parados), a partir da implantação, sem backfill retroativo e sem discriminar por volume | "medir tudo quanto for possível"; correção do dono 12:15 | decisões 21/10 |
| D4 | A resposta 4 do dono ("remover canais vazios") vale só para a lista de canais acompanhados do nicho, não para canais próprios | correção do dono 12:15 | decisões 21/10 |
| D5 | Já coletamos "tudo deles"; o que falta nos terceiros é cruzamento (contexto, lugar/tema, comentários). Gemma só no campo "lugar/tema" dos outliers | resposta 2 do dono; volume pequeno | decisões 21/10; Phil §2 |
| D6 | Uma fonte única de "bombou": a regra do A5 (`outliers.ts`, `multiplier.ts`), sem segundo conceito no A/B Lab | paridade Cowork × Claude Code | Yannis §1 |
| D7 | Núcleo puro calcula; eventos gravados numa tabela com chave única (para dispensar, notificar na transição e expirar); tela, contador e Cowork leem a mesma função | media Phil (tabela) × Yannis (puro) | Hanna A; §3.5 |
| D8 | Ação de terceiro não pré-preenche com a imagem dele; a thumbnail de terceiro é referência de estilo | risco de cópia | Logan §3, Naksu §2, Phil §8 |
| D9 | Regra nativo × nosso: vídeo longo elegível = nativo; Short, kids, 18+, estreia/live agendada e lote = nosso, rotulado "indício por tempo alternado" | parecer nativo × nosso §5 e §8 | Hanna e Yannis replanejar |
| D10 | Portão de volume em toda ação de teste: sem volume, "Sem volume para teste. Trocar direto?" | 0 de 33 vídeos com ≥ 100 impressões em 28 dias [P] | Logan replanejar §2 |
| D11 | Marcador manual "Em teste no Studio" alimenta a guarda da S6; antes de liberar o Studio, pausar e restaurar o nosso e confirmar no YouTube | teste só de miniatura é invisível de fora | Yannis replanejar §3; spec S6/S7 §6.6 |
| D12 | **(o dono confirma)** "Original em alta": fica a regra 1280 (T1) e o aviso antes de iniciar; T2 a T18 congelam com gatilho | o nosso vira exceção; o defeito só aparece nele | decisões 21/10; Yannis replanejar §4 |
| D13 | Nome do botão e desenho final saem do mockup com Logan e Naksu | resposta 3 do dono | decisões 21/10 |
| D14 | Notificação do sistema mais lembrete visual, no A/B Lab e em Competidores | resposta 5 do dono | decisões 21/10 |
| D15 | Ordenar pela força do sinal (medida), não por "ganho estimado em views" (não há estimativa que o dado sustente) | Hanna D | hanna-plano §2 |
| D16 | Contador = sugestões abertas e não dispensadas (estado do produto), não "visto" por quem olha | paridade com o Cowork | Hanna E |

## 2. Coleta (fase F0, antes de tudo)

Regra (D3): vale para **todos** os canais próprios conectados, inclusive os parados com quase nenhum dado, desde o dia da implantação. Nada de busca retroativa. Canal parado custa quase nada (linha esparsa; o banco já rejeita linha com 0 views e 0 minutos, `yt_own_video_traffic_detail_daily_esparsa`) e dá a linha de base que hoje não existe.

### 2.1 Canais próprios: o que já existe [V]

- **Reporting API, 13 tipos habilitados** (`apps/web/src/lib/youtube/reporting/types.ts:11`): alcance (basic e combined), origem de tráfego, básico, combinado, aparelho, local de reprodução, província, demografia, legendas, cards, telas finais, compartilhamento. O passo de jobs (`coleta/jobs-step.ts`) cria o job de cada tipo que falta, por canal, a cada execução do cron de métricas. Logo, canal conectado ganha os jobs sozinho [a conferir: se canal com `collection_status` diferente de `ok`, sem vídeo ou com token antigo é pulado no `coleta/index.ts`].
- **Detalhe da origem por vídeo e por dia** (`yt_own_video_traffic_detail_daily`, migration `20261013000006`): do lote `channel_traffic_source_a3`. Ele já carrega o detalhe de `RELATED_VIDEO` (id do vídeo que levou ao nosso, `reporting/codigos.ts:52`) e de `YT_SEARCH` (termo). É o "pareamento" real do YouTube que Phil e Hanna pediam via Analytics API: **já é coletado pela Reporting API**, com atraso de D+1 a D+3.
- Impressões por origem e aparelho (`yt_own_video_reach_dim_daily`), alcance diário (`yt_own_video_reach_daily`), dimensões diárias (`yt_own_video_dim_daily`), views por hora do canal próprio público (`yt_own_public_video_hourly`, E15).
- **Analytics API diária** (`coleta/analytics-dimensoes.ts`): famílias `traffic_source` (só o tipo, sem detalhe), `device_os`, `country`, `subscribed_status`.
- Termos de busca pela Analytics API (`analytics-client.ts:276`, `fetchYtSearchTerms`): **sob demanda, top 25 do canal, não gravado**.

### 2.2 Canais próprios: o que falta (por expiração)

| # | Item | Expira na origem? | Cota | Volume [E] |
|---|---|---|---|---|
| C1 | **Bruto dos 10 tipos sem normalizador**: hoje é apagado 180 dias depois do download (`SEM_NORMALIZADOR`, `reporting/types.ts`). Guardar sem prazo (comprimido) ou normalizar os úteis (playback_location, demographics, subtitles, cards, end_screens, sharing) | o relatório some do Google depois da janela de retenção dele [a conferir: 60 ou 180 dias hoje]; o nosso bruto some em 180 dias por regra nossa | zero (Reporting não gasta a cota de 10.000) | KB por canal/dia; canais parados quase vazios |
| C2 | Analytics API com **detalhe** (`insightTrafficSourceDetail`) para `RELATED_VIDEO` e `YT_SEARCH`, por vídeo com views no dia, gravado diariamente | dado agregado do Google não expira, mas a Reporting chega com D+1 a D+3; a Analytics dá leitura mais fresca e a confirmação cruzada | cota da Analytics: projeto `tonagarantia`, 100.000 consultas/dia e 720/min [P, memória 12/10]; ~2 consultas por vídeo com views/dia | ≤ 25 linhas por consulta; dezenas a centenas por dia |
| C3 | Termos de busca do canal (`YT_SEARCH`, top 25) gravados por dia, em vez de só sob demanda | sim: a consulta é de janela móvel; o que não for lido hoje com a janela de hoje não se reconstrói igual | 1 consulta/canal/dia | 25 linhas/canal/dia |
| C4 | **Janela de evento**: para cada evento "destino esquentou" (§3.1), marcar os vídeos nossos do destino e garantir leitura diária por origem de -14 a +30 dias | os -14 dias só existem se já estavam sendo gravados: por isso C1 a C3 começam já, em todos os canais | sem cota extra (lê o que C1 a C3 gravam) | 44 dias × vídeos do destino |
| C5 | Na conexão de um canal novo: o mesmo pacote, no mesmo dia, sem passo manual | cada dia sem job é dado que não volta | — | — |

Termo de busca e URL de site externo podem ser dado pessoal: seguem o tratamento já existente (`reporting/traffic-source-csv.ts`, hash do detalhe inteiro e corte em 300 caracteres) e a leitura dentro de `can_view_site`.

### 2.3 Terceiros: o que já existe [V]

- `competitor_raw` guarda a resposta crua, só quando muda (migration `20261012000002`). Partes pedidas: `snippet,statistics,contentDetails,liveStreamingDetails` (`competitor-sync.ts:27`). Campos versionados (`field-catalog.ts:5`): `tags`, `category_id`, `duration_seconds`, `default_language`, `default_audio_language`, `live_broadcast_content`, `comments_disabled`, `likes_hidden`, `views_hidden`, `availability`. Versões de título, miniatura e descrição já existem.
- Marcas de idade D1/D7/D30 (`competitor_video_marks`, migration `20261014000004`).
- **Curva horária existe** (`competitor_video_hourly`, E15, migration `20261013000002`): Phil está certo; o motor de fases do `outliers.ts` é que usa a série diária (`vpd7`), por isso Yannis a viu diária. [a conferir: quais vídeos entram na leitura horária e por quantas horas.]
- Comentários: `competitor_video_comment_snaps`, `competitor_video_comments`, autores (E14).

### 2.4 Terceiros: o que falta

| # | Item | Expira? | Cota | Volume [E] |
|---|---|---|---|---|
| T1 | `topicDetails` (categorias do Freebase/Wikipedia) **não** é pedido hoje | sim, o valor de hoje não se recupera se mudar | zero: `videos.list` custa 1 unidade por chamada independentemente das partes [a conferir na doc] | um array curto por vídeo |
| T2 | Campo **lugar/tema** por vídeo, preenchido pela Gemma (forja) só nos outliers, revisável pelo dono | não expira (deriva de texto já guardado), mas precisa estar pronto quando o evento acontece | forja: 144 claims/dia divididos com o Health Coach [P]; poucas dezenas de outliers/mês [E] | um texto por outlier |
| T3 | Medir a taxa real de outlier por canal nas marcas existentes antes de fixar limiares (consulta `percentile_cont` por canal sobre `competitor_video_marks`) | — | leitura | — |

Fora da coleta: transcrição de terceiros (a API só entrega legenda ao dono do vídeo), embedding de miniatura, texto de comentário além do E14.

## 3. Sinal

### 3.1 "Destino esquentou" (hipótese principal, D2)

Evento por **lugar**, não por vídeo. Dispara quando, para o mesmo `lugar` (T2), há ≥ 2 outliers do nicho nos últimos 14 dias **ou** 1 outlier muito acima da mediana do canal dele (parâmetros versionados, valores do Phil depois do T3). Outlier = regra do A5 (§3.4) mais piso absoluto de views (parâmetro, sugestão de partida: 2.000 em D7) e n mínimo de vídeos com marca no denominador (sugestão: 8). Validade do evento: 30 dias.

Vira sugestão só com cruzamento: existe vídeo **nosso** com o lugar no título ou na descrição (busca textual, custo zero). Sem vídeo nosso, a sugestão é "vídeo novo".

**Não medido:** outlier sem `lugar` preenchido, ou canal sem n mínimo, gera estado `nao_medido` com o motivo; nunca "frio".

### 3.2 "Vídeo parecido bombou"

Outlier do nicho (§3.4) casado com um vídeo nosso por filtro determinístico em camadas: mesmo nicho, mesmo formato, sobreposição de tokens de título, tags e início da descrição (pt e en), e lugar quando houver. A forja entra só na fase F4, para top-K (K ≤ 5) por vídeo nosso, nunca por par (Yannis §3). A frase diz "parecido" em palavras do dono: "mesmo lugar e mesmo tema" ou "tema parecido, lugar diferente".

### 3.3 "Meu vídeo caiu"

Queda de views/dia ou de CTR do vídeo nosso contra a mediana do próprio canal (ou do nicho, enquanto o canal tem menos de ~10 vídeos com série; declarado no motivo). **Portão de volume:** a sugestão mostra impressões/dia e os dias até o piso de teste; se não chega em 28 dias, a ação é "Trocar direto", não "Testar". Regra exata, parâmetros e piso: Phil no plano.

### 3.4 Fonte única

- **Regra de "bombou":** a fase `estourando` do A5 [V, `outliers.ts:30`]: vídeo com até 30 dias e views/dia em 7 dias ≥ `RULES.outlierMin` (2) × a mediana do canal no mesmo formato (`median7`). O sinal reaproveita essa regra e soma o piso absoluto e o n mínimo; não cria outra.
- **Núcleo puro** `lib/youtube/observatorio/oportunidades.ts` (nome provisório): entrada = contexto do motor (`EngineCtx`), vídeos próprios, relógio injetado; saída = lista de oportunidades com `tipo`, `motivo` (frase com os números e a versão da regra), `alvo`, `fonte`, `forca`, ou `motivoVazio` (`sem-historico`, `sem-terceiro-outlier`, `sem-lugar`, `forja-fora`). Nunca `[]` mudo.
- **Tabela de eventos** (nome provisório `niche_signals`): uma linha por evento, chave única `(site_id, kind, subject_id, window_key)`, `rule_version`, `evidence jsonb` (ids, nunca cópia de imagem), `status` (aberto, dispensado, feito, expirado), `first_seen_at`, `expires_at`, motivo de dispensa. Índice parcial em `status = 'aberto'`. Volume: ~0,1 MB/ano [P, Phil §5].
- **Quem grava:** um passo ao fim do sync de competidores (cron de 20 min, `vercel.json:39`) ou na agenda única do A5 (E16), com upsert idempotente pela chave única. Não é tarefa da forja.
- **Quem lê:** uma função de leitura (SQL ou serviço TS) consumida pela tela, pelo contador e pela rota de pipeline/MCP. O N do botão e a lista saem do mesmo resultado, na mesma requisição.
- `getSuggestedVideos` (`ab-lab/queries.ts:823`, hoje top 5 por nota e CTR com ≥ 1.000 views) deixa de calcular e passa a ler a lista.

### 3.5 Notificação

Gerada na transição (evento novo com a chave única), nunca a cada tique do cron. Reaproveita o serviço de notificações existente (`lib/youtube/notification-service.ts`) e a expiração já existente [a conferir: o cron `expire-notifications`].

## 4. Ações sugeridas (por ordem de custo)

Texto da tela: "pode ajudar". Cada ação é um `case` do núcleo e uma linha de teste, não um módulo.

1. **Título e descrição do vídeo antigo:** conferir se o nome do lugar está no título e na descrição; se faltar, propor a troca (ou o teste nativo, se houver volume, D10).
2. **Thumbnail com referência:** o painel mostra a do terceiro ao lado da nossa como referência de estilo, com o texto "Use como referência de estilo, não como cópia". Nunca pré-preenche com a imagem dele (D8). Ação plena só quando o detalhe `RELATED_VIDEO` mostrar que já recebemos tráfego daquele vídeo (sim / não / não medido); com "não", a ação recomendada é título ou tema (Phil §3).
3. **Playlist do destino** com os vídeos antigos do lugar (barata, sem risco; ganho é hipótese).
4. **Vídeo novo** sobre o destino, quando não há vídeo nosso ou com 2+ sinais.
5. **Título complementar:** compara com os títulos passados do dono (todos os canais próprios, D3) e evita repetir ângulo; geração pela forja só na fase F4 (task nova, contexto congelado, validador de números `forja/numbers.ts`).

## 5. A/B replanejado

### 5.1 Regra nativo × nosso (D9)

| Situação | Caminho |
|---|---|
| Vídeo longo, público, com volume | **nativo** (ficha "Testar no YouTube") |
| Lançamento | nativo; nunca os dois juntos |
| Short, kids, 18+, estreia/live agendada | nosso (único caminho), "indício por tempo alternado" |
| Lote | nosso, para varrer e priorizar, não para decidir |
| Sem volume (hoje os 33 vídeos [P]) | nenhum: "Sem volume para teste. Trocar direto?" |

O sistema pré-escolhe o caminho e mostra o motivo; trocar fica atrás de "Prefiro outro caminho" (Logan replanejar §2).

### 5.2 Marcador "Em teste no Studio" e a guarda

- Base: a guarda da S6 fase 2 (`avaliarGuarda`, spec `2026-10-18-ab-s6-s7-guarda-e-nativo-design.md` §6) **ainda não existe no código** [V: não há `avaliarGuarda` em `origin/main`]. O registrador da S7 fase 1 existe em `origin/main` (`lib/youtube/teste-youtube/registro/`), atrás de `AB_NATIVO_REGISTRO` (só `on` liga, `docs/ops/env-vars.md`), com a migration `20261018000006_ab_lab_s7_teste_nativo.sql` [a conferir: aplicada em produção e flag ligada; o replanejar da Hanna diz "em prod desde 19/10"].
- O marcador é a ação "Confirmar teste de miniatura" já prevista na S6 §8.1 (registro `origem = 'confirmado'`, bloqueio `teste_confirmado`). Este spec acrescenta: `valido_ate` = início + 14 dias + margem; marcador vencido não bloqueia para sempre, vira "sem resposta" e pede o resultado.
- **Ordem obrigatória na ficha:** se há teste nosso ativo no vídeo, (1) pausar, (2) restaurar o original, (3) confirmar no YouTube que o original voltou, (4) só então habilitar "Abrir no Studio". Marcar "Em teste no Studio" com o restore não confirmado é recusado. Ao contrário, a rotação escreve durante o nativo e o Studio cancela o teste.

### 5.3 Ficha "Testar no YouTube"

- Até 3 variantes (título e/ou thumbnail), "Copiar título" e "Baixar imagem" por variante, thumbnail sempre em 1280×720 (abaixo disso o Studio reduz tudo a 854×480 [P]); reaproveita a regra 1280 da T1 do plano "original em alta".
- "Abrir no Studio" abre a página do vídeo. No celular: "No computador" e "Lembrar no computador" (o teste nativo é só desktop [P]).
- "Já iniciei" grava o marcador (para título, a S7 também detecta sozinha). Ao abrir qualquer ação do nosso num vídeo com ficha enviada nos últimos 14 dias sem marcador, pergunta "Você iniciou no Studio?".
- **Lembrete no dia 14** (notificação mais selo na linha do vídeo e na lista): 3 botões, "Venceu a nova", "Ficou igual", "Inconclusivo", mais "Não vi". Grava em `ab_native_tests` com fonte "você registrou"; "Inconclusivo" aparece como "sem dado", não "empate"; sem resposta grava `sem_resultado`, nunca vencedor.

### 5.4 Portão de volume (D10)

Vale para os dois caminhos. A ação mostra impressões/dia e dias até o piso; abaixo, "Sem volume para teste. Trocar direto?". Piso e conta: Phil (parecer nativo × nosso §4: ~1.540 impressões por variante para ganho de 50%, com CTR base suposto).

### 5.5 O nosso só como indício

Placar diz "mais views/dia até agora, indício por tempo alternado"; nunca "vencedor" abaixo do piso. Mesmo nome em todas as telas e no Cowork.

### 5.6 Roteiro (`docs/superpowers/plans/2026-10-14-ab-lab-roteiro-e-horas.md`): o que muda, sem renumerar

- 14 (P4b) e 15 (Migration B): sem mudança de escopo; reconfirmar que nenhuma tabela nova depende da Migration B.
- 16 (medição nova): sai do caminho crítico; vira rótulo "indício" e piso. Gatilho: algum vídeo passar de ~110 impressões/dia.
- 17 ("Candidatos a teste"): absorvido pela lista única de Sugestões (§6).
- 18 (telas do A/B): encolhe ao que o nosso caminho precisa (placar "indício", lote).
- 19 (nativo × nosso): fecha com a regra de §5.1.
- 20 e 21 (detecção, S6 a S9): continuam; a S6 fase 2 vira prioridade (entra o marcador, a ordem pausar-restaurar e o resultado manual).

### 5.7 "Original em alta" (D12, o dono confirma)

Fica: T1 (regra única 1280, testes de fronteira 1279/1280) e um aviso antes de iniciar, sem migration nem envio de arquivo. Congela: T2 a T18 (tabela `ab_test_originais`, migrations, rota, MCP, telas). Gatilho de descongelar: o dono rodar o primeiro teste nosso em vídeo longo com ≥ 28 dias e perder a original em alta, ou Short/kids recusado de verdade por original baixa. **Risco a sondar antes de qualquer descongelo:** a guarda de início da T11 ("exige a original em alta") pode **bloquear Shorts** cuja imagem vertical não tem `maxres` 1280, e Short passa a ser o uso principal do nosso; sonda em 2 Shorts reais (Gio ou Phil). Registrar no roteiro como subnúmero de 21.

## 6. Telas (direção; o desenho final e o nome do botão saem do mockup, D13)

- **Lista única "Sugestões (N)"** (nome provisório), aberta por um botão com contador em Competidores e por um bloco no A/B Lab que **substitui** o cartão "Sugeridos para testar" (`ab-lab-dashboard.tsx:401`). Mesmo estado nos dois: dispensar ou fazer num lugar some no outro.
- Linha: chip de origem com símbolo (meu vídeo caiu / concorrente bombou / destino esquentou / candidato), miniatura e título, frase-motivo com o número, régua contra a mediana, um botão primário que diz o que acontece; dispensar é secundário, com motivo de um toque ("não é para mim", "já tratei", "depois", que volta em 7 dias). Até 5 visíveis, "ver todas (N)".
- Selo de estado por vídeo no A/B Lab: "Em teste no Studio", "Teste nosso rodando", "Resultado do YouTube pronto", "Sem volume"; "não medido" em cinza próprio, nunca 0.
- **Notificação do sistema mais lembrete visual nos dois lugares** (D14); o lembrete do dia 14 vive também na linha do vídeo.
- **Estado vazio do canal novo ou parado:** vazio por tipo, com motivo e régua de progresso ("Ainda sem histórico: começa quando o canal tiver N vídeos ou 28 dias"); as sugestões de terceiros já aparecem. Carregando: N como "…", nunca 0. Erro: mantém a última lista boa com "desatualizado".
- Um componente de cartão para todas as variantes; eyebrow com ≥ 12 px (o atual tem 9 px); só tokens `--cms-*`; cor de carga estrutural em `rgba`/hex, nunca `color-mix()`.

## 7. Fases de entrega (ASAP)

| Fase | Conteúdo | Valor | Critério de aceite | Paralelo com a A5? |
|---|---|---|---|---|
| **F0 Coleta** | C1 a C5 (todos os canais próprios), T1, T3; tabela de eventos vazia e a função de leitura (contrato fixo) | nenhum dado se perde a partir da implantação | Phil roda leitura em produção: para **cada** canal próprio conectado, inclusive os parados, há jobs `ativo` dos 13 tipos e, no D+3, linha de coleta ou motivo gravado de por que não; `topicDetails` presente em vídeos coletados depois do corte; termos de busca gravados por dia; teste apaga a variável/flag de cada passo novo e afirma o padrão | sim: é dado, não tela; migration antes do código |
| **F1 Guarda e ficha** | S6 fase 2 com o marcador, ordem pausar-restaurar-confirmar, ficha "Testar no YouTube", lembrete do dia 14 e 3 botões; portão de volume e rótulo "indício"; T1 + aviso (D12) | o 1º lançamento vai ao nativo sem o nosso pisar nele | vídeo marcado "Em teste no Studio" não aparece como sugestão e o nosso recusa aplicar (teste de tabela); marcar com restore não confirmado é recusado; marcador vencido vira "sem resposta" (relógio falso nas duas fronteiras); ficha leva 1280×720 (Gio no Opera); no dia 14 o lembrete aparece | sim; depende dos portões C-17 e C-17b da S6 |
| **F2 Sinal via Cowork** | núcleo puro, eventos, "vídeo parecido bombou" e "destino esquentou" (com T2 pela forja para outliers), rota de pipeline/MCP | o dono pergunta ao Cowork "o que bombou no nicho e eu não tenho?" | Cowork e rota devolvem a mesma lista e o mesmo N; cada linha cita número e versão da regra; teste apaga o histórico e afirma o `motivoVazio`; reexecução não duplica evento | sim |
| **F3 Tela única** | lista "Sugestões (N)" nos dois lugares, notificação na transição | decisão em 3 segundos sem abrir o Cowork | mockup aprovado (Logan, Naksu, dono); N igual em Competidores, A/B Lab e Cowork; dispensar num lugar derruba o N no outro; canal vazio mostra motivo e régua | depois do mockup |
| **F4 Depende de dado** | thumbnail com referência condicionada ao `RELATED_VIDEO`; título complementar pela forja (top-K); "meu vídeo caiu" com portão | ações mais caras só com evidência | cartão mostra "já recebo tráfego dele: sim/não/não medido"; título gerado não afirma número fora do contexto congelado | — |

Caminho crítico até o dono sentir valor: F0 → F1 (o dia 14 do 1º vídeo novo cai em dezembro) → F2. F0 e F2 podem andar junto da A5 a 100% (prioridade do dono de 16/10), porque reaproveitam o motor dela.

## 8. Riscos, incluindo falhar em verde

| Sinal ou peça | O que acontece quando o dado não existe? | Resposta do desenho |
|---|---|---|
| "Destino esquentou" | outlier sem `lugar` (forja fora ou atrasada) gera zero eventos com cara de "nada esquentou" | estado `nao_medido` com motivo `sem-lugar`/`forja-fora`; contagem de outliers sem lugar visível |
| "Destino esquentou" | canal nosso sem série nos -14 dias (coleta começou depois) | a janela registra "linha de base ausente"; o efeito daquele evento não é medido, e isso aparece |
| "Vídeo parecido bombou" | canal de terceiro com menos de n vídeos com marca: razão enorme por mediana minúscula | n mínimo e piso absoluto; abaixo, `nao_medido` |
| "Meu vídeo caiu" | canal novo ou parado sem mediana própria | mediana do nicho, declarada no motivo; sem nenhuma, `sem-historico` |
| Contador | cálculo falhou e a tabela ficou com eventos velhos | `expires_at`; a tela mostra a hora do último cálculo bom e "desatualizado" |
| `RELATED_VIDEO` | detalhe abaixo do limiar do YouTube vem vazio (`detail = ''`) | "sem detalhe" ≠ "não recebo tráfego"; três estados: sim / não / não medido |
| Marcador | dono esquece "Já iniciei" num teste só de miniatura | a guarda libera (furo declarado na S6 §6.6); mitigação: pergunta "Você iniciou no Studio?" ao agir em vídeo com ficha enviada |
| Resultado do nativo | dono não registra | `sem_resultado`, nunca vencedor |
| Coleta F0 | canal parado pulado pelo laço de coleta e nenhuma linha gravada: parece "canal sem dado" | aceite exige linha **ou motivo** por canal; alerta se um canal conectado ficar sem nenhum dos dois |
| Bruto da Reporting | apagado em 180 dias pela regra atual | C1 |
| Cópia | thumbnail de terceiro está no Blob com URL pública (A5 §13) [P] | referência só dentro de `can_view_site`; evidência guarda id, não a imagem |

## 9. Perguntas abertas ao dono

1. **D12, o corte do "original em alta" (fica T1 + aviso; T2 a T18 congelados com gatilho): confirma?** Recomendação: sim (Yannis e Hanna). Custo do sim: se um teste nosso rodar em vídeo longo com imagem pública pobre, a original volta em 480×360 até o gatilho. Custo do não: ~15 tarefas com migration em tabela quente antes do lançamento, para um caminho que virou exceção.
2. **Guardar o bruto dos 10 tipos da Reporting sem prazo (C1), em vez de apagar em 180 dias?** Recomendação: sim, comprimido, até haver normalizador ("coletar mais do que usa"). Custo do sim: alguns MB por canal por ano no Storage. Custo do não: perde-se o que ainda não tem tela.
3. **Thumbnail com referência só quando já recebemos tráfego daquele vídeo (§4.2)?** Recomendação: sim; o que traz o tráfego do outro é tema e título. Custo do sim: a ação de thumbnail espera a F4. Custo do não: sugestão que pode não funcionar e passa em verde.

## 10. Fora de escopo (com gatilho de retomada)

| Item | Gatilho |
|---|---|
| Embedding de miniatura e "parecido" semântico | mais da metade das dispensas em 30 dias for "não é parecido" ou "lugar diferente" |
| Momento de publicar (mapa E15) | canal novo com vídeos suficientes para mapa próprio (n pelo Phil) |
| Push e e-mail de sugestão | o dono disser que perdeu uma sugestão, ou antes da viagem de jan/2027 |
| Integração com API do teste nativo | surgir API pública; aí a leitura troca o marcador manual |
| Busca anônima pela forja (posição do nosso vídeo por termo) | F2 no ar e termos de destino definidos; conferir os termos de uso antes |
| Google Trends | API sair do alpha fechado |
| Views duas vezes por dia para vídeos `estourando` | Phil confirmar que a curva E15 não cobre |
| Original em alta T2 a T18 | gatilho de §5.7 |

## 11. A conferir antes do plano

- Se o laço da coleta (`coleta/index.ts`) pula canal parado, sem vídeo ou com `collection_status` ≠ `ok`.
- Janela de retenção e de backfill da Reporting API hoje (60 ou 180 dias).
- Se `videos.list` com `topicDetails` custa a mesma unidade.
- Migration S7 aplicada e `AB_NATIVO_REGISTRO=on` em produção; estado do P2 (views/dia) em produção.
- Quais vídeos de terceiros entram na leitura horária (E15) e por quanto tempo.
- Cron `expire-notifications` e o serviço de notificações servem a eventos do observatório.
- O checkout principal (`staging` local, `5e581375b`) está atrás de `origin/main` (`b04049787`, que tem `teste-youtube/`); as referências de código da S7 acima são de `origin/main`.
