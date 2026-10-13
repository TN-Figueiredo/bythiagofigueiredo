# Revisão de UX, rodada 2: mockup 16b (Mudanças, "Outras mudanças")

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Escopo: conferir se B1, C1, C2 e C3 da r1 foram resolvidos e se o ajuste criou defeito novo. Medi no Chromium headless (Playwright próprio, servidor estático na porta 47741, derrubado pelo PID ao fim; nada de 3099, banco ou specs do projeto). Minhas capturas: `shots/r2/`.

## Veredito: VOLTA PARA AJUSTE (1 bloqueio, de uma frase)

Os quatro achados da r1 estão resolvidos. O ajuste da B1 deixou uma frase para trás, no ⓘ da caixa de cima, que contradiz o que a própria caixa agora diz (B2 abaixo). Conserto de uma frase; sem outro defeito.

| Largura / tema | Estados (11 casos) | Veredito |
|---|---|---|
| 1440 escuro | trocas, típico (7 d, 30 d, 90 d), magro, extremo, zero, não medido, filtro sem resultado, erro, carregando, sem dado, só leitura | volta para ajuste (só B2, no ⓘ do típico, magro, extremo, zero, não medido, erro, carregando; é a mesma frase em todos) |
| 390 claro | os mesmos 11 | volta para ajuste (só B2) |
| 1440 claro, 390 escuro, 360 | os mesmos 11 | sem achado além de B2 |

## Conferência da r1

| Achado | Resultado | Evidência |
|---|---|---|
| B1 (caixa de cima mudava com a janela) | **resolvido** | Típico com 7 d e 90 d, por URL e por clique: caixa "12 trocas ... mais 5 outras mudanças", aba "Mudanças 12", nos dois. Só o bloco de baixo muda ("3 mudanças em 2 vídeos, nos 7 dias da janela"; "5 mudanças em 4 vídeos, nos 15 dias com histórico"). Extremo 90 d: caixa 63 e 94, aba 63. Zero, magro e não medido a 90 d e 7 d: caixa fixa. Capturas `shots/r2/tipico-7d-1440-escuro.png`, `tipico-90d-1440-escuro-clique.png`, `topo-90d-390-claro.png` |
| C1 (grupos sem nome) | **resolvido** | `role=group` com `aria-label`: "O que mostrar abaixo", "Mudança feita nos últimos", "Formato do vídeo", "Tipo de mudança". Nenhum `group`, `img` ou `button` sem nome nos 66 cruzamentos |
| C2 (sem dado contradizia o cabeçalho) | **resolvido** | `shots/index-caso-vazio-1440-escuro.png` e `shots/r2/vazio-390-claro.png`: "Canais 0", "Mudanças —", "Outliers —", nicho IA 0, barras com "sem canais" em contorno pontilhado. Nenhum zero onde não há base |
| C3 (tela afirmava o que a produção não faz) | **resolvido** | Tabela: "hoje conta título, miniatura e descrição; com esta tela passaria a título e miniatura (dúvida 1: o dono decide)". ⓘ: "Com esta tela, a aba passa a contar só título e miniatura (hoje ela soma a descrição junto: o dono decide)". Dúvida 1 virou "DECIDIR PRIMEIRO" na NOTAS |
| S1, S3, S5, S7 | feitos | seletor sem números (`om-vis`); "O Observatório passa a guardar estes campos em 17/10" (sem "coleta"); `role="img"` nos spans de estado; barra "antes" da duração com opacidade .7 |

## Bloqueio

**B2. O ⓘ da caixa de cima ainda diz que a contagem segue a janela escolhida.** Tela: todos os casos com a caixa de cima, clicar no ⓘ "Por que as outras mudanças ficam fora da conta de Trocas" (`om.js:332`). O mesmo ⓘ diz em um item "Janela: a conta de cima é sempre dos últimos 30 dias... A janela escolhida abaixo vale só para a lista" e, no item seguinte, "Contagem: cada mudança registrada **na janela escolhida**, uma por campo e por sincronização". Duas frases seguidas se desmentem; é exatamente a contradição que a B1 removeu da tela, sobrevivendo no texto do método. Quebra a regra "nenhuma frase afirma mais do que o dado sustenta".
**Correção exata:** em `om.js:332`, trocar "na janela escolhida" por "nos últimos 30 dias" ("Contagem: cada mudança registrada nos últimos 30 dias, uma por campo e por sincronização."). Nenhuma captura precisa ser refeita; reabrir o ⓘ do típico para conferir.

## Melhorias (não bloqueiam)

- **M1. Botões do estado sem dado são `<span class="btn big">`** (`om.js:296`, "Adicionar canal", "Ver todos os nichos"): não recebem foco nem são lidos como botão. No mockup é marcador de lugar; na implementação têm de ser `button`/`a`. Anotar na NOTAS.
- **M2. Sem dado: a faixa de frescor diz "7 canais" e o nicho IA tem 0.** Se o dono estranhar, a faixa é global e a aba é do nicho; vale uma linha na NOTAS dizendo que o frescor continua global.
- **M3. NOTAS descreve o extremo como "30 dias cheios"**, mas com 90 d o extremo tem 90 dias de histórico e 214 mudanças. Os números fecham (94 em 30 d; a caixa fica em 94), só a descrição do caso está imprecisa.
- **M4. Dúvida 2 (aba "Mudanças" contra "Outras mudanças")** segue como pergunta ao dono; é o lugar certo. Nada a fazer.

## O que está bom (não mexer)

Frase-resumo com número em destaque; duas barras na mesma escala com a linha tracejada; a régua de cobertura (hachura rosa só para não medido, traço baixo só para zero medido, coluna para mudança); filtro de tipo que é também a contagem (2+1+1+1+0 = 5; extremo 52+9+18+13+2 = 94); estados mutuamente exclusivos; erro isolado que diz o que não foi afetado; filtro que esvazia não vira zero da janela. Régua de 90 dias a 390 px aberta (`shots/r2/topo-90d-390-claro.png` mostra a caixa; a régua está em `index-caso-tipico-janela-90-390-claro.png`): colunas finas mas a hachura e o início do histórico se leem.

## Medidas (66 cruzamentos: 11 casos x 1440, 390 e 360 x claro e escuro)

| Item | Resultado |
|---|---|
| Rolagem horizontal | 0 px em todos os 66 |
| Texto menor que 12 px | nenhum |
| Alvos de toque a 390 e 360 (`a`, `button`, `select`, `summary`, `[tabindex]`) | nenhum menor que 44 x 44 |
| ⓘ a 1440 | 44 x 44 px |
| Contraste de texto (todo texto de `#screen`, cor composta sobre o fundo efetivo) | menor razão 5,90:1 (carregando, 1440 escuro); 0 abaixo de 4,5 |
| Contraste gráfico | r1: todos acima de 3:1; nada mudou em cores, só a opacidade da barra "antes" (.55 para .7, ganho de margem) |
| Foco visível | 2 px sólido em todos os 22 primeiros itens da ordem de Tab (ⓘ, seletor de visão, 7/30/90 d, formato, ordenar, régua, tipos, horários, "Ver histórico") |
| ⓘ e Esc | abre pelo clique, Esc fecha, foco volta ao botão |
| `color-mix()` | só o comentário "Sem color-mix" em `om.css:1` |
| Erros de console da página | 0 nos 66 |
| `prefers-reduced-motion` | presente |

## O que não consegui verificar

Leitor de tela (ouvir o `aria-label`), Safari e Opera, escala de cinza renderizada (julguei pela forma: ícone, palavra, hachura, caixa vazada, contorno), contraste gráfico refeito (confiei na r1: só a opacidade da barra mudou).

## Para a rodada 3

Corrigir B2 (uma frase) e avisar. Se for só isso, dou "pode ir ao dono" sem refazer capturas.
