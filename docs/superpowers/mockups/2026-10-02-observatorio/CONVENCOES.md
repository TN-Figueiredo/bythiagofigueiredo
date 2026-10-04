# Convenções compartilhadas (obrigatórias para todos os mockups — vencem o que cada um decidiu sozinho)

## Data de "hoje" no mockup
SÁBADO, 24/10/2026, 15:02 (24/10/2026 é sábado no calendário real — use o calendário real para todos os dias da semana) (America/Sao_Paulo). Arquivamento de thumbnails começou em 03/10/2026.
Snapshots diários de views por vídeo começaram em 03/10/2026 (então nenhum vídeo tem mais de 21 dias de curva;
efeitos de trocas antes de 10/10 têm "antes" curto — diga isso).

## Cor e selo da forja
- Token: `--forja: #5CC3B2` (escuro) / `#1A6B5F` (claro); `--forja-subtle: rgba(92,195,178,.12)`; `--forja-line: rgba(92,195,178,.35)`.
- Selo: texto "forja · Gemma 12B" em minúsculas ("forja" é sempre minúsculo, "Cowork" sempre maiúsculo — aprovado pelo dono no Health Coach), seguido da data/hora "gerada 20/10 06:10 (SP)".
- Cowork: `--cowork: #9B93F6`, só dentro do menu ⋯.
- Laranja (`--accent`) = ação primária única da tela/contexto. Forja nunca usa laranja.

## Nomes de ações (idênticos em todas as telas)
- "Pedir leitura à forja" (primeira vez) / "Pedir nova leitura à forja" (quando já existe uma)
- "Salvar no swipe file" ↔ estado "Salvo no swipe file" (toggle)
- "Ver histórico do vídeo"
- "Abrir no YouTube"
- "Sincronizar concorrentes"
- "Adicionar canal"
- Menu ⋯ → "Copiar pedido para o Cowork"
Toasts: "Pedido enviado à forja" → "Leitura publicada"; "Salvo no swipe file"; "Sincronização iniciada" → "Concorrentes sincronizados".

## Estados da forja (rótulos exatos, do Health Coach)
na fila · trabalhando · publicado · atrasado · sem máquina · nova tentativa · falhou · recusado (dado velho)

## Modelo de efeito de troca (mudanças e histórico usam o MESMO)
- Observado: views/dia médio nos 7 dias depois vs 7 dias antes (se "antes" < 7 dias, usar o que houver e dizer "antes: 3 dias").
- Esperado pela idade: variação mediana de views/dia que vídeos do MESMO canal e formato tiveram na mesma faixa de idade, com intervalo interquartil e n.
- Efeito = observado − esperado, em pontos percentuais. Veredito: ganhou (> +10 pp e fora do intervalo) · perdeu (< −10 pp e fora do intervalo) · neutro (dentro) · inconclusivo (n < 5 ou troca simultânea de dois campos em < 48 h) · aguardando (faltam N dias).
- Sempre ícone + texto, nunca só cor. Mostrar "observado −41% · esperado −38% (n = 31)".

## Multiplicador de outlier
"8,2× vs vídeos do canal com 31–90 dias (n = 12)". Faixas de idade: 0–7, 8–30, 31–90, 91–365, 365+ dias. n < 3 = "base fraca".

## Filtros
- Global (barra da moldura, vale para todas as abas, persistido): Nicho = Todos · Viagem · IA.
- Formato Longos/Shorts: por aba onde faz sentido (Outliers, Insights, Mudanças), padrão Longos.
- Janela: por aba (Mudanças = quando a troca ocorreu 7/30/90 d; Outliers = idade 30 d/3 m/6 m/12 m/mais antigo; Insights = 90 d).

## Tipografia e números
Fraunces só no título da página e em leituras da forja; Inter UI; JetBrains Mono só em números tabulares.
Números pt-BR: "1,5 mil", "207,6 mil", "1,9 mi", "8,2×", "−41%" (sinal de menos U+2212), datas "24/10", horas "09:00".
Datas relativas + absolutas no title/tooltip: "há 6 h" (title="24/10 09:02").

## Mockup chrome
Barra de "Estados do mockup" no TOPO, recolhível, com borda tracejada — nunca fixa sobre o conteúdo.
Tema: toggle + `?theme=light|dark`.
Thumbnails placeholder: 16:9, fundo em 2 tons sólidos (sem gradiente arco-íris), texto grande em caixa alta típico de thumb, rosto como silhueta simples (círculo + ombros). Shorts em 9:16 só na aba Outliers > Shorts.

## Cobertura de dados (decisão — resolve dúvidas dos revisores)
- Snapshot diário de views para TODOS os vídeos acompanhados de cada canal (os do `video_limit`, até 200), não só os ≤ 90 d.
  Começou 03/10 → em 24/10 todo vídeo acompanhado tem até 21 dias de série. "views/dia (7 d)" existe para vídeo antigo também.
- Vídeos fora do `video_limit` não têm série: dizer "fora dos vídeos acompanhados".
- Curtidas, comentários e tags EXISTEM (vêm da Data API no sync atual). Tags estão no idioma do canal — lacunas por tag literal
  devem avisar "tags em outro idioma não casam"; preferir temas da forja (bge-m3 + rótulo 12B) a tags cruas.
- Snapshots de concorrentes e a série de views começaram em 03/10; nenhum dado de "dia N de vida" existe para vídeos publicados antes disso.

## Ajuste por idade — método (Outliers e Histórico usam o mesmo)
- Vídeo publicado depois de 03/10 (série desde o dia 0): comparar views no mesmo dia de vida com a mediana dos outros vídeos do canal no mesmo dia de vida ("método: mesmo dia de vida").
- Demais: mediana das views dos OUTROS vídeos do canal na mesma faixa de idade (0–7, 8–30, 31–90, 91–365, 365+) — rótulo "método: aproximação por faixa".
- O próprio vídeo nunca entra na base ("sem contar este vídeo"). n < 3 = base fraca.
- Janela de Outliers em faixas EXCLUSIVAS: 0–30 d · 31–90 d · 91–180 d · 181–365 d · mais de 1 ano, mais "Todos". Padrão: atalho "Até 90 dias" (seleciona as duas primeiras faixas); faixas são multi-selecionáveis.

## Tokens: ajustes de contraste AA aprovados (todas as telas aplicam iguais)
Escuro: muted `#A89D88` (sobe do BRIEF #958A75, AA em surface), dim `#958A75`, faint só decorativo (nunca texto),
danger-texto `#F26B6B`, tier-top `#E0735C`. Contagens em abas usam `--dim`, não `--faint`.
Claro: bg `#F7F2E9`, surface `#FBF7F0`, surface-2 `#F2EBDF`, side `#EDE5D5`, border `#DDD2BF`, text `#231C14`,
muted `#5E5240`, dim `#6E624E`, accent `#B8481A` (texto do botão primário `#FFF8F1` dá 5,0:1), warning `#B45309`,
success `#11692F`, danger `#B42318`, forja `#1A6B5F`, cowork `#5B4FD9`.
Cor nunca é o único canal; nunca usar `opacity` para rebaixar texto (use `--dim`).
Alvos interativos ≥ 32×32 px (área clicável pode exceder o ícone visual).
Tabelas: `<table>` real ou roles completos (columnheader/cell). Abas com aria-controls + setas.

## Selo de leitura da forja
Cabeçalho do card mostra o ESTADO do pedido atual. O selo "forja · Gemma 12B · gerada 20/10 06:10 (SP)" pertence à LEITURA,
então em estados na fila/trabalhando/falhou/sem máquina ele vai para o cabeçalho da leitura anterior.
Toda evidência citada pela forja tem link "Ver os N vídeos" que abre Outliers/Mudanças já filtrado.
Números da forja e números das tabelas vêm da MESMA fonte no mockup (um único objeto de dados) — nunca podem divergir.

## Datas de leituras da forja
Última leitura publicada: 20/10/2026 06:10 (SP). Leitura anterior: 13/10. Nunca usar 28/09 (anterior ao "hoje" de 24/10 em quase um mês = leitura velha só se for intencional).

## Precisão temporal das trocas
- Sync de concorrentes a cada 6 h (00, 06, 12, 18 SP) — proposta do subprojeto A.
- Título e descrição: só sabemos a JANELA ("entre 24/10 06h e 12h"; "visto pela 1ª vez 24/10 12h"). Durações aproximadas ("≈ 1 d"). Nunca minuto.
- Thumbnail: horário do upload vem do ETag do CDN (precisão de minuto) — pode mostrar "24/10 09:14".
- Trocas de campos diferentes na mesma janela de sync = "na mesma janela" (efeito inconclusivo para separar).
- Views/dia por período: períodos < 24 h → "menos de 1 dia no ar, sem média" (sempre). Períodos que cortam um dia → "≈" + "inclui dia compartilhado".
- Nada de efeito/média/veredito antes de 7 dias pós-troca: só "aguardando — 3 de 7 dias coletados, leitura em 28/10".

## Vocabulário de UI (sem jargão)
"sincronização" (não sync), "comparação linha a linha" (não diff), "detectada pela mudança do arquivo da imagem" (não ETag),
"dados enviados à forja" (não snapshot). "Thumbnail" e "Descrição" por extenso (abreviação só em faixa estreita, com title=).
"média de views/dia". Fuso declarado uma vez por tela: "Horários em São Paulo".

## Hierarquia de ações (decisão)
- No máximo UM botão preenchido por vista. Cabeçalho da moldura não tem preenchido: "Adicionar canal" é neutro no cabeçalho e
  vira o primário só dentro da aba Canais (estado vazio/topo da tabela).
- Ações da forja usam a cor da forja (teal). Quando a ação da forja é a primária do contexto (Insights, drawer da forja),
  ela é o único preenchido (teal sólido, texto escuro #0E2A25 / claro #FFFFFF conforme AA). Fora disso, contornada.
- Laranja preenchido: primário de contexto que não seja forja (ex.: "Adicionar canal" na aba Canais).

## Fila da forja: o que existe vs o que o design propõe (subprojeto E)
- HOJE: fila por channel_id, status pending/running/completed/failed/stale; site só grava o claim; "atrasado" = pedido > 25 min sem
  ser pego (LATE_AFTER_MINUTES); "sem máquina" = > 24 h na fila (UNSERVED_AFTER_HOURS); watchdog libera running > 30 min ("stale").
- PROPOSTO (o mockup mostra o alvo; listar no painel "Dependências novas" da barra de estados do mockup, NUNCA na UI do produto):
  `task_type` (leitura de concorrentes: padrões de título, temas, resumo das trocas), `niche`, status `refused` + motivo,
  cota 1 pedido/dia/tipo, heartbeat `last_poll_at` gravado a cada consulta da forja (mesmo vazia).
  Com heartbeat: "sem máquina" = sem consulta há > 30 min (3 ciclos); "atrasado" = máquina viva mas pedido > 25 min sem ser pego.
- Estado "liberado pelo watchdog (travou > 30 min) — volta para a fila" existe e deve aparecer.
- Recusa por dado velho: o site já sabe a idade do sync → avisar e desabilitar NO SELETOR ("Viagem sem sincronização desde 26/09 —
  sincronize antes"); estado "recusado" só para o que o site não prevê.
- Tempo: "tempo deste tipo ainda não medido" até haver ≥ 5 leituras; depois "mediana das últimas N: X min".
- Cowork: não há deep link com prompt. Item do menu ⋯: "Copiar pedido para o Cowork" (copia e mostra "cole no Cowork com ⌘V").

## Linha de descrição em listas
Descrição nunca usa old/new riscado. Mostra o título do vídeo sem risco + chip "+6 −2 linhas" + "Ver comparação".

## Fallback do método de idade
"Mesmo dia de vida" com n < 3 → cai para "aproximação por faixa" (e diz "método: aproximação por faixa — poucos vídeos do canal com série desde o dia 0"). Só mostra "base fraca" se a faixa também tiver n < 3.

## Rodada 2 — decisões adicionais (valem para todas)
- Forja no claro = `#1A6B5F` (o #1F7A6C dava 4,3:1 sobre o fundo subtle).
- Texto pequeno sobre `surface-2`/fundos tintos usa `--muted`, nunca `--dim` (dim só sobre bg/surface).
- Última sincronização no "hoje": 24/10 12:00 (SP) → "sincronizado há 3 h" (title "24/10 12:00 (SP)"). Próxima 18:00.
- Botão primário da forja = teal sólido `.btn.forja-primary` (escuro: fundo #5CC3B2, texto #0E2A25; claro: fundo #1A6B5F, texto #FFFFFF). NUNCA laranja.
- Leitura publicada é CONGELADA: números do texto = base enviada na data do selo ("dados enviados à forja: 100 longos até 20/10"). Mudanças posteriores aparecem à parte: "Desde então: +5 vídeos. Peça nova leitura para atualizar."
- Tempo de leitura: só 2 leituras deste tipo existem (13/10 e 20/10) → "tempo deste tipo ainda não medido (2 leituras; mediana a partir de 5)".
- Toda afirmação de padrão exige: n ≥ 10 do lado "usam", diferença ≥ 0,3×; "costuma" (horário) exige o par dia+hora com ≥ 3 vídeos e ≥ 30% do total, senão "horário variado (n = 4)". Atribuição a "dois canais" só se o 2º tiver ≥ 20%; se o 1º tiver > 60%, "{canal} sozinho assina 12 dos 13".
- Links entre telas: Outliers aceita e APLICA os parâmetros `niche, fmt, age (faixas), min (multiplicador), theme, formula, channel`; Mudanças aceita `niche, type, channel, video`; Histórico aceita `video`. Quem linka usa esses nomes.
- Painel "Dependências novas" (na barra de estados de TODA tela que mostra pedido à forja): task_type, niche, escopo do pedido, status refused+motivo, cota 1/dia/tipo, last_poll_at.
- Sidebar do CMS no mockup em PT: "Competidores" (não "Competitors").
- Contagens das abas na moldura: respeitam o nicho global.
- Fuso: "Horários em São Paulo" uma vez por tela; nunca "horário de Brasília".
- Erro de console "Unsafe attempt to load URL file://" vem de abrir via file:// com links/âncoras — é artefato aceito; não é bug.

## Contagens das abas (fixas e idênticas em TODAS as telas, nicho = Todos)
Canais **14** (canais monitorados) · Mudanças **18** (trocas nos últimos 30 dias, todos os tipos, longos+Shorts, contadas por evento) ·
Outliers **11** (longos, até 90 dias, 2× ou mais) · Insights sem contagem.
Cada aba explica a contagem no title= da aba. A tela dona do número deve ter dados que reproduzam exatamente esse número no filtro padrão
(Mudanças: janela 30 d; Outliers: longos, até 90 d). Com nicho Viagem/IA as contagens podem mudar, mas só a tela dona as calcula; as demais
telas mostram as mesmas contagens fixas por nicho: Viagem → Mudanças 8, Outliers 5; IA → Mudanças 10, Outliers 6.
Cor do nicho IA: azul `#6EA8FE` (escuro) / `#1D4ED8` (claro); Viagem: verde `#5BBF8A` / `#11692F`. (Não colidir com cowork violeta.)

## Rodada 3 — ajustes finais de token
- Forja no claro: texto/borda `#17695C`, fundo subtle no claro `rgba(23,105,92,.06)` (≥ 4,5:1 com texto 11,5 px). Botão sólido no claro: fundo #17695C, texto #FFFFFF.
- Item ativo da sidebar no claro: fundo `rgba(184,72,26,.08)` sobre side, texto `#9A3A12`.
- Trecho de UTM/ruído no claro: `#8A3F06`.
- Classe do botão sólido da forja: `.btn.forja-solid` em TODAS as telas.
- Fila: "tempo deste tipo ainda não medido"; atrasado = "Máquina ativa (última consulta há N min), mas o pedido está na fila há M min — o limite é 25 min"; vigia = "O vigia liberou o pedido (travou > 30 min) — volta para a fila (tentativa 2 de 3)". Nada de "costuma sair em até 20 min" nem especulação.
- Warning como TEXTO no claro: `#92400E` (o #B45309 fica só para ícones/bordas). Tag "seu canal" no claro: texto `#9A3A12` + borda, sem fundo tinto.
- Botão de fechar/ícones: 32×32 mínimo.
- Plural: "Ver a troca", "Ver o outlier" quando N = 1.
- Veredito com "antes" ≤ 2 dias = inconclusivo ("antes: 1 dia — pouco para comparar"). "Neutro" = efeito dentro da faixa OU |efeito| < 10 pp; o texto diz qual dos dois.
- Outlier = ≥ 2× (abaixo disso "1,6× a mediana", sem a palavra outlier e sem cor de faixa).
- DADOS DO MOCKUP: gere a partir de UMA lista de vídeos por canal (id, publicado_em, formato, série diária de views desde 03/10 ou desde a publicação). Mediana de views/dia, multiplicadores, n por método, cadência, contagens e "vídeos mais recentes" são DERIVADOS dessa lista por código. Nunca digitar n, mult, pw ou contagens.

## Correção de calendário e histórico anterior a 03/10 (vence tudo acima)
- 24/10/2026 é SÁBADO. Dias da semana sempre pelo calendário real (28/10 = quarta, 21/10 = quarta, 22/10 = quinta, 20/10 = terça).
- Histórico ANTERIOR a 03/10 que existe de verdade (o observatório roda desde 31/05 com sync diário às 09:00 SP):
  * Trocas de TÍTULO com texto antigo e novo: existem desde 31/05; precisão = janela de 1 dia ("entre 15/08 09h e 16/08 09h").
  * Trocas de DESCRIÇÃO antes de 03/10: só "a descrição mudou" (sem texto) — mostrar isso honestamente.
  * Trocas de THUMBNAIL antes de 03/10: não confiáveis (método antigo por URL) — não mostrar como troca; no máximo "thumbnail vista desde 03/10".
  * Efeito de qualquer troca antes de 03/10: sem série por vídeo → "Sem série antes da troca (coleta por vídeo desde 03/10)".
- A partir de 03/10: sync a cada 6 h (00/06/12/18 SP); título/descrição em janela de 6 h; thumbnail com minuto.
- Não existe corte de "14 dias" para veredito: vale só o modelo de efeito (aguardando < 7 d depois; inconclusivo se n < 5, antes ≤ 2 d, ou dois campos na mesma janela/< 48 h).
- A projeção "esperado" nas sparklines é cálculo do SITE: tracejado em `--muted`, nunca na cor da forja.
- Vocabulário: "vigia" (como no Health Coach real: "O vigia liberou o pedido"), nunca "watchdog" na UI.
- Leitura "Padrões de título dos outliers" usa janela de 6 MESES (para ter n suficiente), dito no título da leitura; leituras anteriores do mesmo tipo: 13/10 e 20/10. Se mesmo assim n < 10 em um padrão, ele vira "recorrência observada (n = 7) — pouco para concluir".
- Na moldura, com o drawer da forja aberto, nenhum outro botão preenchido fica visível (o primário da aba vira contornado).

## Rodada 3 — complementos
- Contagens por nicho completas: Todos 14/18/11 · Viagem 8/8/5 · IA 6/10/6 (Canais/Mudanças/Outliers). title= obrigatório em cada aba.
- Abas são LINKS entre os arquivos (canais.html, mudancas.html, outliers.html, insights.html) com aria-current="page" na atual. Nada de tabpanel vazio.
- Cota: falha e recusa NÃO consomem a cota de 1/dia/tipo ("falha e recusa não contam na cota"). Painel mostra "usada hoje: 0" nesses casos.
- Com pedido na fila (inclusive "sem máquina"/"atrasado"), o botão vira desabilitado "Pedido em andamento" e o texto diz "Seu pedido das HH:MM está na fila e roda quando a máquina voltar".
- Links de evidência de leitura congelada levam `asof=2026-10-20` (ou dizem "hoje são N").
- Canal sem sincronização há > 24 h fica FORA do escopo de pedidos à forja, dito no pedido ("Esq Unltd Daily fica fora: sem sincronização há 3 dias").

## INTEGRAÇÃO (vence tudo acima sobre dados)
`dados.js` (window.OBS, API em DADOS.md, testes em dados-teste.html) é a ÚNICA fonte de dados e cálculos de TODAS as telas.
Cada tela carrega `<script src="dados.js"></script>` e REMOVE seu conjunto local (CH, VIDS, OPUS, GEN, TAB_COUNTS, __mock etc.).
Proibido recalcular efeito/multiplicador/outliers/contagens/cadência localmente — usar OBS.effect, OBS.multiplier, OBS.outliers,
OBS.tabCounts, OBS.cadence, OBS.channelStats, OBS.forja.*, OBS.formulas, OBS.themes, OBS.link.*, OBS.date, OBS.fmt.
Se faltar algo na API, NÃO crie dado local: registre em `scratchpad/observatorio/PEDIDOS-API.md` (o coordenador amplia dados.js).
Vídeo-vitrine do Histórico: `matt-opus55` (207,6 mil). Todos os links usam OBS.link.* e todas as telas aceitam os parâmetros da CONVENCOES.
Parâmetro de cor de tema na URL continua `theme=light|dark`; tema da forja em Outliers usa slug (`comida-de-rua`), sem colisão.

## RODADA FINAL — regras comuns a todas as telas
- Nicho: TODAS leem e gravam localStorage['obs-niche'] ('todos'|'viagem'|'ia'); ?niche= na URL vence e é persistido.
- Tema de cor: TODAS leem e gravam localStorage['obs-theme']; ?theme= vence e é persistido; links entre telas não precisam levar theme.
- Sidebar do CMS no mockup em PT em TODAS: Painel, Próximos, Agenda, Notificações · Blog, Vídeos, Cursos, Newsletters, Campanhas, Listas de espera, Playlists · Pesquisa, Referência, Mídia, Áudio · Canais, Vídeos, A/B Lab, Desempenho, Competidores · Posts, Links.
- Breadcrumb/links internos sempre via OBS.link.* (nunca href="#").
- Pedido em andamento (na fila, trabalhando, atrasado, sem máquina, nova tentativa, liberado pelo vigia): botão desabilitado "Pedido em andamento" + linha de status do requestScenario. Cota usada: botão desabilitado com quota.text. Pedido novo usa requestScenario('na fila', {createdAt: OBS.NOW}).
- Botão da forja: sólido só em Insights e no drawer da moldura; contornado nas demais (Outliers, Mudanças, Canais, Histórico? → Histórico: sólido, pois a leitura do vídeo é ação primária daquela tela).
- Outliers aceita `min=0` = "todos os vídeos com a fórmula/tema" (lista sem cor de faixa, "1,6× a mediana") e `asof=AAAA-MM-DD` = chip "Link da leitura de 20/10: ela via N; hoje são M". Quem linka conta N exatamente como o Outliers vai mostrar.
- "Abrir no YouTube": sempre video.url / channel.url, nunca "#".
- Plural/singular com F.plural/F.verVideos; evidência de trocas diz "troca(s)", de vídeos "vídeo(s)".
- Nada de jargão de implementação na UI (nada de "OBS.", "file://", nomes de função).
- Herói acima da dobra a 1440×900: leituras longas da forja recolhidas por padrão (1 linha por nicho + "Ver leitura").
- `[hidden]{display:none!important}` em todas.
- Mudanças: formato padrão = "Longos e Shorts" (para reproduzir 18 na aba); Longos/Shorts são filtros opcionais.
- Atraso de sincronização sempre "há 39 h" (motor: date.ago usa horas abaixo de 48 h).
- Texto do estado sem máquina IDÊNTICO em todas: "Seu pedido das HH:MM está na fila e roda quando a máquina voltar."
- Histórico usa o contexto de origem (`from=`) no breadcrumb e no paginador; sem `from`, Mudanças.
- CHROME ÚNICO: depois desta rodada, sidebar + cabeçalho YouTube + cabeçalho do Observatório (título, subtítulo, linha de sincronização) + barra de nicho + abas + barra "Estados do mockup" + toggle de tema virão de `chrome.js`/`chrome.css` compartilhados. Não invista em chrome local nesta rodada além das regras comuns.
- CSS das telas: TODO seletor da tela escopado em `#screen` (ou prefixo próprio da tela); nunca estilizar classes genéricas (.forja, .sw, .btn, .tag, .dot) no escopo global — o chrome usa `.ch-*` e não pode ser afetado. Auditoria: comparar estilos computados de `.ch-*` com e sem o CSS da tela.
- Toasts adicionais aprovados: "Tirado do swipe file", "Pedido cancelado".
- Parâmetros que apontam para um objeto de outro nicho (?video, ?channel): a tela ajusta o nicho global para o do objeto (CHROME.setNiche silencioso) e mostra um toast "Nicho mudou para Viagem para mostrar este vídeo". Nunca mostrar vazio por conflito de nicho.
- Nome do recurso do YouTube: "Testar e comparar" (nome da UI em PT), com "(teste A/B do YouTube)" na primeira menção. Substitui "Test & Compare" em todas as telas e no motor.
- Estado vazio só afirma "não mexeram" se a consulta sem os filtros locais (busca, tipo, canal, efeito medido) também der 0; senão diz qual filtro esconde.
- Horário de pedido novo = OBS.NOW ("enviado agora"); nunca minutos negativos.
- Auditoria de tokens: toda custom property usada pela tela deve resolver para valor não vazio (pega regressões de escopo de CSS).
- Clique no status do pedido no cabeçalho (#ch-req-status) NUNCA cria pedido: abre/rola até o andamento na tela (CHROME onStatus).

## RODADA F3 — decisões
- Status no cabeçalho (forjaFromScenario, único formato nas 6): "na fila · pedido 14:58", "trabalhando desde 14:45", "atrasado · pedido 14:33", "sem máquina desde 12:55", "nova tentativa · 15:05", "liberado pelo vigia · 15:05", "falhou às 14:21", "recusado às 14:56", "publicado às 14:50". Hora sempre do evento que o rótulo nomeia.
- Mock "na fila" usa o createdAt do cenário (14:58) em todas as telas; OBS.NOW só para pedido criado por clique.
- "…roda quando a máquina voltar" SÓ no estado sem máquina; nos demais, statusText do motor.
- Nicho Todos: TODAS as telas permitem pedir; o pedido vira um por nicho (split), respeitando cota por nicho. Nenhuma tela desabilita por "escolha um nicho".
- ?video/?channel de outro nicho: o nicho muda SÓ na exibição desta tela (CHROME.setNiche(n,{silent:true, persist:false})) + toast; o localStorage não é alterado.
- Breadcrumb/voltar preserva o filtro de origem: links para o Histórico levam `back=<query codificada>`.
- Rótulos de estado de sincronização vêm do motor (gênero/termos únicos: "atrasado", "erro", "buscando vídeos", "parado").
- Moldura (exceção registrada): o botão do cabeçalho segue habilitado com cota usada porque o seletor oferece outros tipos/nichos livres.
- Tokens próprios de tela em `#screen{…}`, nunca em :root.

## RODADA F4 — decisões
- Parâmetro de TEMA DE CONTEÚDO = `topic=` (OBS.link.outliers e todas as telas). `theme=` é só cor (light|dark); outro valor é ignorado e cai no localStorage.
- Status no cabeçalho também para estados terminais: "publicado às 14:50", "falhou às 14:21", "recusado às 14:56" (sem botão de andamento; só a pílula).
- Hora em estados de espera futura: "nova tentativa às 15:05" e "vigia liberou às 14:56 · volta às 15:05" (nunca hora futura sem dizer que é previsão).
- Canal com sincronização atrasada/erro: vídeos dele vão para a fase "Sem ritmo medido" (motor), nunca "Estourando agora".
- Janelas temporais em "há N": para trocas com janela, "vista pela 1ª vez há N h" (motor agoText).
- Links das abas do chrome usam o nicho PERSISTIDO, não o de exibição (persist:false).
- Tela com pedido em andamento: botão "Pedido em andamento" desabilitado + status curto; frase completa só no card da tela.
- `back=` carrega SÓ a query string da origem (começando com "?"), com o filtro completo (inclui drawer aberto como channel=). O destino monta `<arquivo da origem><back>`.
- Links que apontam para um objeto (vídeo, troca, canal) NÃO levam `niche=`; o destino ajusta a exibição com persist:false.

## RODADA F6 — decisões
- Fases de outlier: "Estourando agora" (≤ 30 d, série ≥ 7 d), "Recentes" (31–90 d), "Perenes", "Antigos", **"Novos" (menos de 7 dias de série; canal em dia)** e "Sem ritmo medido" (SÓ canal atrasado/erro/buscando).
- Linhas de status por nicho (Todos) = "<Nicho>: " + statusLabel do pedido (hora do evento).
- Sincronização no mockup: SEMPRE via OBS.runSync({channel?}). Só canais ok viram "agora"; erro/atrasado/buscando mantêm o próprio estado e aparecem no resultado como problema. Depois do runSync, chrome e telas fazem refresh (frescor "sincronizado agora"). Nunca toast de sucesso para canal com problema.
- Concordância: telas compõem com OBS agoShort ("há 3 h") e concordam o particípio com o sujeito.
- (F7) Efeito em pp: SEMPRE inteiro (F.pp) em todas as telas. Trocas com caveats ficam FORA das medianas (grupo "com ressalva").
- (F7) Com Todos, toda tela usa UM requestScenario(s,{niche:'todos'}); cabeçalho = forjaFromScenario(R) sem sobrescrever; cards internos listam R.statusLines, uma por nicho. Nunca pílula terminal enquanto qualquer nicho está ativo.
- (F7) Frase de problema de sincronização: channel.sync.problemPhrase do motor, em todas as telas.
- (F7) Toda tela passa onSynced ao CHROME.mount e redesenha o que depende de sync (tabelas, avisos, "fica fora"). Aviso de início: "Sincronização iniciada".
- (F7) Idade de vídeo exibida SEMPRE de video.ageDays via OBS.fmt.age(v) ("há 30 dias"; < 1 d "há N h"), nunca D.ago(pub) — senão contradiz as faixas.
- (F7) Topo do conteúdo: o chrome fixa #screen 16 px abaixo das abas. O PRIMEIRO filho visível de cada tela não tem margin-top nem padding-top próprios (o conteúdo começa exatamente no topo do #screen nas 6 telas).
- (F8) Mock da forja: com nicho único, requestScenario(s,{niche}); com Todos, {niche:'todos'}. Pedido novo por clique COMPÕE (mantém os pedidos dos outros nichos), nunca substitui o cenário inteiro.
- (F8) Diálogos/modais da tela vivem fora de #screen (filhos de body) para não ficarem inertes atrás do drawer modal do chrome.
- (F8) Com Todos, o card/barra da forja na tela mostra as statusLines E logo abaixo o sc.statusText (frase completa, inclusive "Seus pedidos das HH:MM estão na fila e rodam quando a máquina voltar."). Nunca só no title.
- (F8) Exceção: o Histórico (um vídeo) usa o requestScenario do nicho do vídeo, sem divisão por Todos.
- (F8) Mudanças com ?reading= só abre o card da leitura; a LISTA não muda. Quem lê back=?reading= de Mudanças (Histórico) mantém a lista do resto do back.
- (F8) Particípio sempre por tipo: título → visto/trocado; thumbnail e descrição → vista/trocada. Nunca usar agoText (feminino fixo) com sujeito masculino.
- (02/10, dono) Limite de canais: 75 concorrentes (o seu não ocupa vaga); o admin destrava +25 manualmente quando se aproximar. Contador "N de 75 canais"; nunca vagas negativas.
- (F8 conjunto) Textos canônicos do motor, obrigatórios em todas as telas: forja.since(id).shortText (linha recolhida) e .text (detalhe); effect.noBaseText (n = 0); effect.readyText (aguardando); channel.sync.problemPhrase. A sincronização persiste entre telas (OBS.replaySync na carga).
- (F9) Limite de canais: OBS.RULES.channelLimit = 50, conta SÓ concorrentes (o seu canal não ocupa vaga). Telas leem do motor, nunca número fixo; vagas nunca negativas.
- (F9) Sob o selo da forja só aparece texto da leitura (reading.text.*), literal. Qualquer frase do site (ressalva, paráfrase) fica fora do selo, em Inter.
- (F9) Pedidos à forja no mockup: estado ÚNICO no motor (OBS.forja.session), por nicho, persistido em sessionStorage como a sync. Telas NUNCA guardam pedido próprio: lêem session.current(nicho|'todos') e pedem com session.ask(nicho). O mock da barra de estados define a base (session.setBase(estado)). Trocar de nicho/tela nunca cria nem apaga pedido.
- (F9) Sem máquina com Todos: "Seus pedidos das HH:MM (IA e Viagem) estão na fila e rodam quando a máquina voltar." (variante plural oficial; nicho único mantém a frase original).
- (F9) Toda chamada a OBS.forja.session passa {type} explícito: Canais/Mudanças 'resumo-trocas'; Outliers/Insights(padrões) 'padroes-titulo'; Insights(temas) 'temas'; Histórico 'leitura-video' + video.
- (F10) Com Todos e um nicho ocupado, o botão continua habilitado para pedir o(s) nicho(s) livre(s) ("Pedir leitura de Viagem à forja"); o ocupado aparece como linha de status. Só desabilita quando nenhum nicho do escopo está livre.
- (F10) Mediana de efeito só com n ≥ RULES.minN (5); abaixo disso, contagem por veredito + faixa (mín–máx) com "pouco para concluir".
- (F11) Pedidos de TIPOS diferentes no mesmo nicho são permitidos (cota e ocupado são por nicho+tipo; a fila é global). Só bloqueia o mesmo tipo no mesmo nicho/alvo.
- (F11) Rótulo curto do botão de nicho livre: "Ler IA" / "Ler Viagem" (nome inteiro em aria-label).
- (F11 conjunto) "Desde então": maiúscula, sem ponto final, em linha própria; minúscula só logo após rótulo com dois-pontos. Views de canal parado: "até o registro diário de DD/MM HH:MM".

## Nichos como dado (multi-canal, 04/10)
- Nicho = Todos · <nichos do site, na ordem de `sort_order`>. Os de fábrica são Viagem e IA, com as cores atuais. Onde a forja enumera nichos, a ordem é IA, Viagem e depois os demais.
- A mesma ordem vale na barra de nicho, no seletor de nicho da linha, nos grupos da tabela e no formulário de adicionar canal. Nicho sem canal não ganha grupo na tabela.
- Barra de nicho: uma linha, ao lado das abas. Quando os nichos não cabem, o trilho da barra rola para o lado com o degradê das abas e o nicho ativo é trazido para a vista. A página nunca rola para o lado. Sem menu "Mais".
- Adicionar canal: até 3 nichos, botões; a partir de 4, seletor.
- Cores dos nichos criados pelo dono: ameixa `#D29AE8` / `#7B2A91`, rosa `#F293C2` / `#A3216B`, lima `#B9CB62` / `#55650B`, ardósia `#AAB4C0` / `#4B5563` (escuro / claro). Nenhuma repete cor com significado (laranja, teal da forja, violeta do Cowork, âmbar, vermelho, ciano). Passando de quatro nichos criados, as cores se repetem em ciclo. A cor nunca vem sem o nome do nicho.
- Nicho criado pelo dono não tem lista de temas: Temas e Lacunas dizem “Ainda não há lista de temas para <Nicho>. Padrões de título, o mapa de publicação e “Você no nicho” funcionam normalmente.”, sem selo da forja. Fórmulas usa só as universais (preço, número, pergunta, superlativo, primeira pessoa). Um pedido de leitura de temas para ele não é enviado: “Nada enviado: <Nicho> ainda não tem lista de temas.”; com Todos, o nicho fica fora do pedido e aparece como “<Nicho>: sem lista de temas”.
- Nicho sem concorrente (de fábrica ou criado pelo dono): o botão da forja fica desabilitado com “Nenhum concorrente em <Nicho> ainda”, nada é enviado, e o nicho não entra no pedido de Todos. Sem concorrente em nenhum nicho, o pedido de Todos fica desabilitado com “Nenhum concorrente em nenhum nicho ainda”.
- Frases que contam nichos: com exatamente Viagem e IA, ficam como eram (“…em nenhum dos dois nichos.”, “…o de Viagem fica na fila atrás do de IA.”, “Misturar viagem e IA…”). Com outro conjunto: “…em nenhum nicho.”, “…os demais ficam na fila atrás do de <primeiro da ordem da forja>.”, “Misturar nichos…”. Listas de nichos usam vírgula e “e” (“Viagem, IA e Jogos”).
- Um nicho que não existe (mais) no site — preferência salva, link antigo — abre em Todos, sem erro. Um canal que aponta para um nicho fora da lista aparece em Todos e no grupo “Sem nicho”.
- Pode haver mais de um canal próprio no mesmo nicho e no mesmo idioma. Nenhum texto diz “canal principal”.
