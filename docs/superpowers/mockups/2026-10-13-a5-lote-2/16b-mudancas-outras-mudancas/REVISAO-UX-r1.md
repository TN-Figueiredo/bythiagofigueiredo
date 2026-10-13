# Revisão de UX, rodada 1: mockup 16b (Mudanças, "Outras mudanças")

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Material: `PLANO.md`, `NOTAS.md`, `index.html`, `om.css`, `om.js`, as 44 capturas de `shots/` e as minhas (`shots/r1/`). Medi no Chromium headless (Playwright, servidor estático próprio nas portas 47731 a 47738, derrubado ao fim de cada script; nada de 3099, banco ou specs do projeto). Contraste calculado sobre cor composta lida do estilo computado.

## Veredito: VOLTA PARA AJUSTE (1 bloqueio, 3 "corrige")

| Largura | Estados (11 casos) | Veredito |
|---|---|---|
| 1440 escuro | trocas, típico, magro, extremo, zero, não medido, filtro sem resultado, erro, carregando, sem dado, só leitura | volta para ajuste (B1 vale para todos os que têm a caixa de cima) |
| 390 claro | os mesmos 11 | volta para ajuste (B1; C1; C2) |
| 1440 claro e 390 escuro | os mesmos 11 | sem achado além dos acima |

A pergunta do dono ("além das trocas de título e miniatura, o que mais eles mexeram, e posso confiar no número?") **é respondida em 3 segundos**: a frase ("12 trocas de título ou miniatura; mais 5 outras mudanças fora desta conta"), as duas barras com a linha tracejada entre elas e a régua de cobertura (hachura rosa = não medido) dizem o número e a janela dele. A régua é a melhor ideia da tela. O que reprova é uma contradição de números que aparece com um clique (B1).

## Bloqueio

**B1. A caixa de cima diz "a conta da aba acaba aqui" com um número que não é o da aba.** Tela: típico, 1440 escuro (também 390), depois de clicar em 7 d ou 90 d. A aba segue em "Mudanças 12", mas a caixa passa a "31 trocas de título ou miniatura" (90 d) ou "5 trocas" (7 d), ainda sob a legenda "a conta da aba acaba aqui" e o ⓘ "É a conta da aba". Em produção a aba conta **sempre 30 dias** (`apps/web/src/lib/youtube/observatorio/outliers.ts:107-114`, `changesIn(ctx, { days: 30, niche })`). Evidência: `shots/r1/tipico-90d-1440-escuro.png` (aba 12, caixa 31); janelas medidas no navegador: 7 d = 5 e 3; 30 d = 12 e 5; 90 d = 31 e 5. O dono vai clicar em 90 d na primeira volta, e o item 39 de aceite ("a conta Trocas é igual na lista, no painel e na comparação") fica visivelmente quebrado. Quebra a regra "nenhuma frase afirma mais do que o dado sustenta".
**Conserto:** a caixa de cima fica **fixa em 30 dias** e diz isso na própria frase ("nos últimos 30 dias, como a aba"), e o filtro "Mudança feita nos últimos" passa a mandar só no bloco de baixo (a frase do bloco já traz a sua janela). Se preferir manter a janela mandando nas duas, troque a linha tracejada por "a conta da aba (sempre 30 dias) acaba aqui: 12" quando a janela não for 30 d. Refazer capturas de `tipico` com 7 d e 90 d.

## Corrige (vai ao dono só depois de corrigido)

**C1. Dois grupos de botões sem nome acessível.** Tela: todas com lista. `div[role=group]` de "7 d / 30 d / 90 d" e de "Todos / Longos / Shorts" não têm `aria-label` (o rótulo visível "Mudança feita nos últimos" e "Formato do vídeo" é um `<span class="om-lb">` solto); os outros dois grupos têm. Um leitor de tela lê "grupo, 7 d" sem dizer de quê. **Conserto:** `aria-label="Mudança feita nos últimos"` e `aria-label="Formato do vídeo"` nos dois `div`.

**C2. Sem dado (nicho IA sem canal): cabeçalho contradiz a tela.** Captura `vazio-1440-escuro-330-900.png`: a tela diz "Nenhum canal acompanhado neste nicho: não há o que contar", mas a faixa de abas mostra "Canais 7", "Mudanças **0**" e "Outliers 9"; o seletor de visão da caixa mostra "—" para o mesmo dado. Em produção `tabCounts(niche)` filtra canais por nicho (`outliers.ts:112`): com o nicho IA, Canais seria 0. Um zero onde a regra da própria tela é "nulo nunca vira zero". **Conserto:** no caso `vazio`, passar a `L.obs` as contagens do nicho (Canais 0) e mostrar "—" nas abas que ficam sem base (Mudanças e Outliers), igual ao "—" do seletor; ou, se a aba real mostra 0 mesmo assim, o dono decide e a NOTAS anota.

**C3. A tela e a tabela de referência afirmam o que a produção não faz.** Tabela "A conta, caso típico": "Aba Mudanças 12: título + miniatura (**não mudou**)"; ⓘ da frase: "Descrição… não entra em nenhuma das duas contas". Em produção a aba conta **título, thumbnail e descrição** (`outliers.ts:131`, `TAB_TITLES.mud`). Ou seja, o 12 de hoje inclui descrição, e o "não mudou" é falso: ou a aba muda de fórmula (cai) ou a caixa não é igual à aba. A NOTAS já levanta isso na dúvida 1, mas a tela e a tabela falam como se estivesse resolvido. **Conserto:** (a) trocar "não mudou" na tabela por "hoje conta título, miniatura e descrição; o dono decide (dúvida 1)"; (b) subir a dúvida 1 para o primeiro item do guia do dono; (c) no ⓘ, tirar a frase "Descrição… não entra" ou escrevê-la como a proposta ("com esta tela, a aba passa a contar só título e miniatura").

## Sugestões (não bloqueiam)

- **S1. O mesmo número cinco vezes.** No típico a 1440 o "5" aparece na frase de cima, na barra, no seletor "Outras mudanças 5", na frase do bloco e em "Todas 5". O seletor repete o que a barra logo acima já diz. Faça cada barra ser o botão da visão (ou tire os números do seletor).
- **S2. Colisão de nomes.** A aba se chama "Mudanças" e a frase diz "5 outras mudanças fora desta conta". Pergunte ao dono se a aba deve passar a "Trocas" (ele decide; hoje a NOTAS só pergunta pelo rótulo "Outras mudanças").
- **S3. "coleta" é jargão leve.** Painel de não medido ("A coleta começa em 17/10") e ⓘ da régua ("o dia em que a coleta destes campos entrou"). Prefira "o Observatório passa a guardar estes campos em 17/10".
- **S4. Lista fechada de 6.1.5.** O motivo "o histórico dessas mudanças começa em dd/mm" deve entrar na lista fechada como foi feito nos specs 02 e 03; anotar na NOTAS.
- **S5. `aria-label` em `<span>` sem papel** (`om-zero` "zero medido", `om-ct` "não carregou", "carregando", "sem canais"): não é anunciado de forma confiável. Use `role="img"` nesses spans (como já está no `nm-h`) ou texto só para leitor de tela.
- **S6. "exemplo" aparece uma vez, na caixa de cima.** Basta para o mockup; na implementação a marca some e o que é real vem do banco.
- **S7. Barra "antes" da duração no claro mede 3,62:1** (opacidade .55). Passa em 3:1, mas fica na margem; subir para .7 dá folga.

## O que está bom (para não mexer na rodada 2)

Cor estável: hachura rosa só para não medido, caixa vazada `--im-zero` só para zero medido, pontilhado só para "ainda não existe", família do erro só para erro; nenhum verde ou âmbar de direção em mudança de campo. Cada tipo lê por símbolo e palavra, sem depender de cor. Soma fecha (2+1+1+1+0 = 5; extremo 52+9+18+13+2 = 94; 4 vídeos = 1+2+1+1). A régua bate com os cartões (dias com coluna = datas dos cartões, conferido dia a dia no típico). Dias da semana corretos para 2026. Erro isolado e carregando com texto que diz o que não foi afetado. Filtro que esvazia não vira zero da janela.

## Medidas

| Item | Resultado |
|---|---|
| Rolagem horizontal, 390 e 360, 6 casos x claro | 0 px em todos |
| Alvos de toque a 390 (11 casos, `a`, `button`, `select`, `summary`) | nenhum menor que 44 x 44 |
| Alvos a 1440 (ponteiro fino) | seletores 34 px, ⓘ de "Horários" 28 px (convenção do lote) |
| Texto menor que 12 px | nenhum (`medidas.json` dos 44 cruzamentos; conferi o mesmo critério) |
| Contraste de texto, 44 cruzamentos (caso x largura x tema), todo texto de `#screen` | menor razão 5,90:1 (escuro) e 6,43:1 (claro), 0 abaixo de 4,5 |
| Contraste gráfico (escuro / claro) | coluna de mudança 14,5 / 15,8; barra Trocas 16,2 / 14,2; zero medido no traço 4,97 / 4,84; caixa do zero 4,75 / 4,36; borda do seletor 4,86 / 5,59; chip 6,18 / 7,13; borda da hachura 4,09 / 4,57. Todos acima de 3:1. Borda da trilha da barra 1,44 / 1,77, mas a informação está no preenchimento, não nela |
| Foco visível | 2 px `--accent` em ⓘ, select, botões de tipo, links (conferido na ordem de Tab) |
| ⓘ e Esc | abre pelo clique; Esc fecha; o foco volta ao botão |
| `color-mix()` | 0 no CSS/JS da tela (só em comentários "sem color-mix") |
| `a4.css`, `a4-comum.js`, `lote.css`, `lote.js` | idênticos aos do lote 1 (`cmp`) |
| IDs duplicados | 0; SVG sem `aria-hidden` e sem nome: 0; `prefers-reduced-motion` presente |
| Cliques testados | Tags, Formato (0), 90 d, "Mostrar mais 10" (extremo: 10 para 20 cartões); frases e contagens respondem |

## O que não consegui verificar

Leitor de tela (a leitura de `aria-label` em `<span>` é a regra da ARIA, não ouvida), Safari, Opera (onde o `color-mix` quebra; a tela não o usa), ordem de teclado completa pelo grupo de janela e formato (confirmei só que são `button` nativos), simulação de escala de cinza renderizada (julguei pela forma: ícone, palavra, hachura, caixa, contorno), a régua de 90 dias a 390 px (colunas de cerca de 3,6 px; não abri a captura), e a escolha lembrada no navegador.

## Para rodada 2

Corrigir B1, C1, C2, C3; gerar de novo `tipico` com 7 d e 90 d (1440 escuro e 390 claro) e `vazio`; avisar. Capturas desta rodada: `shots/r1/`.
