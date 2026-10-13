# Revisão de UX, rodada 10: Mockup 13, Histórico do vídeo de concorrente (A5, lote 2)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Rodada curta, só o que a r9 deixou aberto. Lido: `REVISAO-UX-r9.md`, `NOTAS.md` seção 20.
Como medi: servidores estáticos próprios nas portas 47731 a 47733 (derrubados ao fim; 3099, 47700 e 47701 não tocadas), Chromium headless do Playwright, sem rede externa. 14 estados x 1440 e 390 x escuro e claro (56 cargas). Capturas em scratchpad; olhei `saiu` 1440 escuro (página inteira) e `saiu` 390 claro (topo).

## Veredito: PODE IR AO DONO

0 "bloqueia", 0 "corrige", 3 sugestões (nenhuma nova é defeito).

## O que conferi

1. **"corrige" da r9 resolvido, `saiu` e `mantido`, 1440 e 390.** Frase: "A última contagem, em 08/10, foi de 7.657 views, depois de 4 dias de contagem. A contagem termina em 08/10." O gráfico dia a dia tem 4 barras com views (05, 06, 07 e 08/10: 3.828 + 1.964 + 1.076 + 789 = 7.657), então "4 dias de contagem" bate com o desenho e o total bate com a frase. A curva por idade termina em "Com 3 dias" e a tela não diz "Com 4 dias" em lugar nenhum (varredura nos 14 estados: 0 ocorrência). Unidades distintas e rotuladas: "Com N dias" = idade; "N dias de contagem" = leituras das 12:00. A frase repete o mesmo 4 no aviso da subida ("saiu do YouTube com 4 dias de contagem"). `mantido` herda o mesmo texto.
2. **Sugestões aplicadas, sem defeito.**
   - Zero medido: "O normal do canal: não medido, nenhum vídeo chegou a esta idade (o mínimo é 3)" aparece nas leituras de 14 d e 21 d (`saiu`); com n = 2 a frase continua "só 2 vídeos (o mínimo é 3)" (`zero`, `saiu` 7 d). Nenhum "só 0" na tela.
   - Mudança depois das 12:00: no `cheio`, leitura de 18/10 pelo teclado (seta no gráfico dia a dia, 1440 e 390): "dom 18/10: 9.934 views. Mudou neste dia, depois da contagem das 12:00: descrição (mudança 3)." 18/10/2026 é domingo, correto. Foco visível (contorno sólido 2 px) nos 3 gráficos; Esc devolve sem erro.
   - `vazio`: "sincronizado há 20 min", descoberto às 18:00, primeira contagem por hora às 19:00 de hoje, primeira por dia às 12:00 de amanhã: coerentes entre si. `naomedido`: 76 horas igual no chip e na explicação.
3. **Varredura de coerência nos 14 estados (texto renderizado).** 0 "NaN", "undefined" ou "null"; 0 "Com 4 dias"; 0 "só 0"; idade publicada coerente (há 3, 5, 8, 9, 33, 34, 40 e 92 dias contra o desenho de cada estado); "Precisa de 15 dias... são N. Faltam M" soma 15 em `magro` (11+4), `recente` (3+12), `zero` (9+6) e `aovivo` (5+10); datas de "fecha em" plausíveis.
4. **Medidas.** Rolagem horizontal: 0 px nos 56 casos. Texto menor que 12 px: 0. Alvos menores que 44 px a 390 (toque): 0. Erros de script ou de console: 0. Contraste do texto novo: frase-resumo 14,5 px, 14,48:1 escuro e 15,76:1 claro; leitura do gráfico (`.ic-out`) 13 px, 6,92:1 escuro e 6,43:1 claro. Todos acima de 4,5:1.

## Sugestões que sobram (não impedem)

- S4 e S5 da r9 seguem como dúvidas 11 e 12 para o dono (total das 72 horas contra "Com 3 dias" só no botão de informação; faixa "exemplo" curta a 390). Levar ao dono como estão.
- A frase-resumo de `saiu` empilha duas frases quase iguais ("A última contagem, em 08/10..." e "A contagem termina em 08/10."). Funciona e é negrito na segunda; se o dono achar repetitivo, cortar a segunda, que o gráfico já repete.
- A 390 o resumo de `saiu` ocupa 5 linhas antes da faixa de números; aceitável, sem rolagem lateral.

## O que não verifiquei

Leitor de tela (NVDA, VoiceOver); Safari e Firefox (só Chromium); toque real em aparelho (usei emulação com ponteiro grosso); simulação em escala de cinza só pelos símbolos já aprovados nas rodadas anteriores, sem nova captura em cinza; fontes externas bloqueadas (a captura usa a fonte de reserva); só li pontualmente as 72 horas e as semanas, não os 72 pontos de novo, porque nada nelas mudou nesta rodada.
