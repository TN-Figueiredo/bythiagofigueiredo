# Brief — Redesenho do Observatório de Competidores (mockups para aprovação)

Rota real: `/cms/youtube/competitors` em bythiagofigueiredo.com (CMS pessoal de um criador de
YouTube brasileiro, Thiago Figueiredo — canal PT "tnFigueiredo" sobre viagem/IA, canal EN em preparo).
Usuário único: o dono (super_admin), em desktop largo (~1440–2000 px), CMS escuro por padrão.

**Isto é MOCKUP HTML estático, não código de produção.** Nenhum arquivo do repo é editado.
Cada mockup é UM arquivo `.html` autocontido (CSS inline, JS mínimo só para alternar estados/abas),
salvo em `/private/tmp/claude-501/-Users-figueiredo-Workspace-bythiagofigueiredo/0f1f72be-f55a-4925-af04-6c8e9a456f4b/scratchpad/observatorio/`.
Screenshots do estado atual: `.../0f1f72be-f55a-4925-af04-6c8e9a456f4b/images/{1..6}.png` (leia com Read).

## Trabalho do produto (o "porquê")
O dono monitora ~14 canais (viagem: Luke Damant, bald and bankrupt, Dale Philip, Paddy Doyle,
Leo Khev, Nômade Raiz, Matheus Fonseca, Vou sem volta; IA: Matt Wolfe, Nate Herk, Sabrina Ramonov,
The AI Advantage, Preguiça Artificial, Esq Unltd Daily) para decidir **o próximo vídeo, título e thumbnail**.
Perguntas que a tela tem que responder:
1. O que os concorrentes mudaram em vídeos já publicados (título/thumb/descrição) — **o antes e o depois** — e **isso funcionou?** (views/dia antes vs depois da troca).
2. O histórico completo de UM vídeo: todas as thumbnails, todos os títulos, todas as descrições, com datas e a curva de views marcando cada troca.
3. O que está estourando **agora** (recorte temporal: 30 d, 3 m, 6 m, 12 m, mais antigo), separado por formato (longo vs Shorts) e por nicho (viagem vs IA), com multiplicador **ajustado pela idade** do vídeo.
4. Padrões acionáveis (fórmulas de título, horários, temas emergentes) — **sem número inventado**.
5. Pedir à **forja** (máquina local do dono com LLM Gemma 12B que roda análises numa fila; é o centro de P&D do YouTube) uma leitura/análise, e acompanhar o andamento. O **Cowork** (agente Claude) vira secundário.

## Regra número 1: este sistema falha em VERDE — nunca fabricar
- Todo número mostra **de onde vem**: janela ("últimos 90 dias"), amostra ("n = 23 vídeos longos"), frescor ("sincronizado há 6 h").
- Dado ausente = estado vazio **honesto e acionável** ("Sem snapshots suficientes — o efeito da troca aparece 7 dias depois dela"), nunca 0, nunca "há -1d", nunca texto fixo.
- Amostra pequena = rótulo explícito ("n = 2 — pouco para concluir") em vez de esconder ou afirmar.
- Horários sempre em **America/Sao_Paulo**, rotulados como tal.
- Comparação "vs você" só contra o canal real do dono e em métrica relativa (ex.: multiplicador típico, views/inscrito), nunca absoluta contra canal 100× maior.
- Thumbnail antiga só aparece se foi arquivada; se não foi ("trocas antes de 03/10 não têm a imagem antiga"), diga isso.
- A forja (12B, sem visão) **não** julga thumbnails nem afirma causa; ela classifica padrões, nomeia temas, resume. Saídas dela levam selo "forja · Gemma 12B" e data.

## Fatos de dados que o design pode assumir (pós "subprojeto A")
- Tabela de versões por vídeo: cada valor distinto de título / descrição (texto inteiro) / thumbnail (imagem arquivada no Blob, detectada por ETag do CDN com horário da troca) com `first_seen_at`/`last_seen_at`. Volta a um valor antigo é visível (revela teste A/B do próprio YouTube "Test & Compare").
- Snapshots **diários** de views por vídeo (últimos 90 dias de cada canal). Antes de 7 dias de coleta pós-troca, o efeito é "aguardando".
- `is_short`, `published_at`, nicho do canal (atribuído pelo dono), status/frescor do sync por canal.
- Descrição: mostrar **diff legível** (linhas adicionadas/removidas; ignorar só espaço/UTM, com toggle "mostrar ruído").
- Fila da forja com estados já existentes no Health Coach: na fila · trabalhando · publicado · atrasado · sem máquina · nova tentativa · falhou.

## Sistema visual existente (respeitar — é o CMS do dono, não um site novo)
Tema escuro (padrão) — tokens:
- bg `#1A1714`, surface `#221E1A`, surface-hover `#272219`, side `#100E0B`
- border `#332D25`, border-subtle `#2A251F`, border-strong `#40382D`
- text `#F5EFE6`, muted `#958A75`, dim `#928871`, faint `#5C5345`
- accent `#FF8240` (hover `#FF9A60`, subtle `rgba(255,130,64,.12)`, deep `#D24E22`, on-accent `#1A120A`)
- success `#22c55e`, warning `#f59e0b`, danger `#ef4444`, info `#06b6d4`
- tiers de outlier: mid `#60A5FA`, high `#A78BFA`, top `#D9614A`; youtube `#FF3333`
- cowork `#9B93F6` (subtle `rgba(110,99,242,.15)`)
- radius base 2px (cards do CMS usam ~6–8px); sombras escuras discretas
Tema claro também existe (bg creme `#EDE5D5`-ish lateral) — suporte obrigatório via `prefers-color-scheme` + toggle `data-theme`; escolha valores claros coerentes.
Tipos: **Inter** (UI), **Fraunces** (títulos de página — "Observatório de Competidores" é Fraunces), **JetBrains Mono** (números tabulares). Google Fonts permitido.
Chrome: sidebar esquerda do CMS (Hub/Content/Library/YouTube/Social), topo "YouTube" com abas Painel · Vídeos · A/B Lab · Categorias · Comentários · Conteúdo · **Competidores** · Desempenho. Mockup pode simplificar a sidebar (faixa estreita) mas deve mostrar o contexto.

## Princípios de design deste brief
- **Um herói por tela**: a coisa mais característica do mundo do YouTube aqui é a **thumbnail + título lado a lado, antes → depois**, e a **curva de views com marcadores de troca**. Gaste a ousadia aí; o resto calmo.
- Densidade de ferramenta de analista, não landing page. Números tabulares alinhados, mono só para números.
- **Ação primária única por contexto**; laranja só para ela. Nada de CTA laranja repetido em cada card.
- Evitar tiques de IA: eyebrows ALL-CAPS em tudo, "A · B · C" em todo meta, "→" em todo botão, gradientes decorativos, cards idênticos com a mesma sombra. Usar só onde codifica informação.
- Copy PT-BR com acentos, sentence case, verbo claro ("Pedir leitura à forja", "Salvar no swipe file", "Ver histórico do vídeo"). Nada de "em desenvolvimento" em produção. Nada de mistura "trocou title".
- Acessibilidade: contraste AA (atenção ao dim sobre surface), foco visível, `prefers-reduced-motion`, alvos ≥ 32px, cor nunca é o único canal (ganhou/perdeu tem ícone + texto).
- Responsivo até ~768 px sem quebrar (é CMS desktop-first, mas não pode estourar).

## Conteúdo realista (use estes, invente coerente no resto)
- Matt Wolfe: "dev - The New AI model that has people talking" → "This AI Model Is INSANELY Fast & Cheap" (há 6 h, 1,5 mil views)
- Sabrina Ramonov: "How I Built a $1M Solo AI Business ($0 to $1M)" → "I Forced Myself to Build $1M Business with AI" (há 4 dias, 19,8 mil)
- Matt Wolfe: "Opus 5.5 Is Crazy Good and GPT-6 Sol Launched Too" → "Claude Opus 5.5 Didn't Need to Go This Hard" (há 6 dias, 207,6 mil)
- Nate Herk: "No, Seriously. Claude Code is Starting To Get Dangerous" — descrição alterada (há 3 dias, 58 mil)
- Outliers: "Trying a $2.70 Pakistan's version of KFC" (Luke Damant, 1,9 mi, 21 d — é Short), "Ninja Training Dojo in Arima Onsen, Japan" (Dale Philip, 7,4 mi, 298 d), "Como criar vídeos cinematográficos e virais com o Hailuo" (Preguiça Artificial, 382 mil, 154 d), "GPT-6 Astra Is Finally Here" (Matt Wolfe, 500 mil, 28 d)
- Thumbnails: use blocos com gradiente/forma e rótulo do texto da thumb (ex.: "HAILUO TUTORIAL", "BIGGEST LEAP YET") — sem imagens externas; ou `https://i.ytimg.com/vi/<id>/hqdefault.jpg` NÃO (não temos ids reais garantidos). Placeholders desenhados em CSS são ok e devem parecer thumbnails (16:9, texto grande, rosto = círculo).

## Entregável de cada agente
1. O arquivo HTML.
2. Uma nota curta (≤ 200 palavras) com: decisões, o "elemento memorável", estados cobertos, e o que ficou de fora.
Se tiver as ferramentas `mcp__plugin_chrome-devtools-mcp_chrome-devtools__*` (carregue via ToolSearch), abra o arquivo com `file://`, tire screenshot em 1440 px e 768 px, e autocritique antes de entregar.

## REQUISITO NOVO (dono, 02/10): permitir mais canais
- Hoje o limite é 15, fixo em dois lugares (page.tsx:29 MAX_CHANNELS e actions.ts:29-34, "Limite de 15 canais atingido"). O dono vai apagar alguns, mas precisa de mais vagas.
- Bug visto em produção: o modal "Adicionar canal" mostra "-1 vagas restantes" depois de adicionar a 15ª (add-channel-modal.tsx:154 subtrai addedIds de um slotsRemaining que já foi recalculado após o refresh — conta dupla). O servidor bloqueia certo; é só exibição.
- Alvo provisório de desenho: até 50 canais (a confirmar com o dono).
- Gargalos reais a tratar no spec:
  1. Cron `sync-youtube?mode=competitors` sincroniza todos em série dentro de UMA função de 300 s (route.ts:130-170). Com 50 canais × backfill isso estoura; precisa de lotes/fila (por exemplo N canais por execução, cursor por last_sync).
  2. Cota da YouTube Data API: ~3–9 unidades por canal por sincronização (channels + playlistItems + videos por página de 50). 50 canais × 4/dia ≈ 1,8 mil das 10 mil diárias — cabe, mas o backfill inicial custa mais.
  3. Forja: o snapshot do pedido cresce com os canais; orçamento acoplado 20 min claim < 25 min cron < 30 min watchdog. Escopo do pedido precisa de teto (ex.: só canais do nicho, top N vídeos).
  4. Tela Canais: tabela/cards e o seletor da forja precisam aguentar 50 linhas (busca, agrupar por nicho, paginação ou virtualização, contador "16 de 50").
