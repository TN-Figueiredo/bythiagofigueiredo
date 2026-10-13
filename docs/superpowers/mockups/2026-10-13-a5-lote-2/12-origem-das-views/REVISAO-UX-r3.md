# Revisão de UX, rodada 3: mockup 12 (origem das views, termos e sites, aparelho, país, inscritos)

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Pasta: `docs/superpowers/mockups/2026-10-13-a5-lote-2/12-origem-das-views/`.
Método: Chromium headless (Playwright, `file://`, fontes externas bloqueadas, sem servidor, sem porta 3099, sem spec do projeto). 33 casos (vídeo e canal x 10 estados, só leitura nas duas variantes, três períodos, 9 cartões da comparação) x 4 cruzamentos (1440 e 390, claro e escuro) = 132 medidas de rolagem, fonte, alvo, estouro de largura, contraste de texto composto e `color-mix()` nas folhas de estilo. Capturas novas `shots/r3-*.png` (par obrigatório de todos os casos: 1440 escuro e 390 claro). Olhei em recorte a 1:1: típico canal 7 dias (1440 escuro), não medido canal (1440 escuro e 390 claro), magro canal (1440 escuro, 390 claro), revisão e erro do canal (1440 escuro). Li o `aria-label` de todas as barras e réguas e a tabela de referência de 10 estados. Teclado: 40 passos de Tab a 1440 e a 390, Enter e Esc no ⓘ.

## Veredito: VOLTA PARA AJUSTE (1 bloqueio, achado agora; os 3 itens da r2 estão resolvidos)

Os três itens que a r2 pediu para reconferir (B1, C7, C8) estão resolvidos e o ajuste não criou defeito novo. Mas, ao reler as telas inteiras, achei um bloqueio que **já existia e que a r2 deixou passar** (assumo a falha): a célula "dias com origem medida" do cabeçalho do canal diz **7 de 7** no estado "Não medido", em cima de um cartão que diz "não guardamos a origem". É a mesma família do B2 da r1: um número na tela afirma o que o estado nega. Correção de uma linha.

## Conferência dos itens da r2

| Item | Resultado | Evidência |
|---|---|---|
| B1: `aria-label` da barra de origem no magro dizia "0% (0)" | **resolvido** | Lido do DOM no magro (canal e vídeo): "Pesquisa do YouTube 22% (3); Vídeos sugeridos 14% (2); Início e inscrições: sem número do YouTube, pode estar no omitido; Feed de Shorts: sem número...; Sites e apps de fora: sem número...; Outras origens: sem número...; omitido pelo YouTube 64% (9)." Nenhum "0% (0)" nos 33 casos fora do estado zero. As impressões e os inscritos do magro só listam o que tem número. |
| C7: tabela de referência contradizia o estado | **resolvido** | Não medido, erro, sem dado e carregando: sem tabela. Em revisão: "Views dos dias medidos 3.185 / Soma das origens (exemplo) 3.219 / Resultado: A soma passou do total em 34: em revisão, a divisão não aparece" (vídeo: 826 e 860). Magro, extremo, zero, só leitura: soma + omitido "fecha" e confere (14 = 5 + 9; 412.864 = 400.477 + 12.387). |
| C8: "4205" sem separador | **resolvido** | `aria-label` da régua no extremo: "Origem medida em 8 de 4.205 dias, de 08/04/2015 a 11/10/2026." |
| Sug. 1 da r2 (símbolo na fatia pequena de inscritos) | feita | Magro 390 claro: fatia de 7% com o ícone de pessoa-visto visível. |

## A pergunta do usuário e a resposta em 3 segundos

Pergunta: **"de onde vêm as minhas views, e posso confiar nesse número?"**. A 1440 px, sem rolar, no típico: frase com chip da líder, régua de cobertura (7 de 7), barra de 40 px com o maior contraste da tela, última fatia tracejada do omitido. Responde. No magro a frase abre com o símbolo do omitido e diz "só 5 views das 14... 9 omitidas"; a barra é dominada pelo tracejado. Responde. A 390 px o cartão começa abaixo da dobra por causa do cabeçalho aprovado (dúvida 9 da NOTAS, não é desta tela).

## Contagem por estado e largura

Par obrigatório (1440 escuro, 390 claro); os outros dois cruzamentos só por medida, limpos.

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| Típico vídeo (7 dias e desde a publicação) | ok | ok | contas fecham |
| Típico canal (7, 28, 90 dias) | ok | ok | 28 e 90: "8 de 28", "8 de 90" |
| Extremo canal e vídeo (desde 2015) | ok | ok | faixa quebrada, 4.205 com separador |
| Magro (canal e vídeo, 90 dias) | ok | ok | B1 da r2 resolvido; "—" e aria concordam |
| Zero medido | ok | ok | caixa vazada nos largos, linha nos pequenos |
| **Não medido, canal** | **volta (B1-r3)** | **volta (B1-r3)** | cabeçalho "7 dias com origem medida de 7" |
| Não medido, vídeo | ok | ok | sem a célula (cabeçalho do vídeo não tem) |
| Sem dado ainda | ok | ok | |
| Erro, canal e vídeo | ok | ok | `role="alert"`, botão 44 px a 390 |
| Carregando | ok | ok | esqueleto liso, `role="status"` |
| Origem em revisão | ok | ok | tabela lateral certa; ver melhoria 2 |
| Só leitura (sem termos e sites / só o total) | ok | ok | |
| Cartão da comparação (9 casos) | ok | ok | |

## Bloqueios (impedem ir ao dono)

### B1-r3. Estado "Não medido" do canal: o cabeçalho diz "7 dias com origem medida de 7"

- **Onde:** `?estado=nao-medido&tela=canal`, quarta célula do cabeçalho. Capturas: `shots/r3-nao-medido-canal-1440-escuro.png` (y 105 a 160 do recorte, célula "7 / dias com origem medida / de 7") e `shots/r3-nao-medido-canal-390-claro.png` (linha das células, y 320 a 370).
- **O que está errado:** logo abaixo, o primeiro cartão diz "Ainda não sabemos de onde vêm as views: a coleta começa em 14/10" e "não guardamos a origem; não é zero". Cima e baixo se contradizem no estado cuja razão de existir é mostrar "não medido". É o primeiro número que o dono lê e é falso para o estado. Regra do dono: nenhuma frase afirma mais do que o dado sustenta.
- **Evidência:** `ov.js:287` usa `C.cO.ok`, que no estado `nao-medido` continua sendo 7 (a data de coleta falsa "14/10" só entra em `COLETA_TXT`, `ov.js:119`). Texto lido do DOM: "dias com origem medida | de 7 | 7". O mesmo estado no vídeo não tem a célula, por isso só o canal quebra.
- **Correção exata:** em `ov.js:287`, quando `estado === 'nao-medido'`, a célula mostra `0` com o sublinhado "de 7" (e, se o desenho preferir, o símbolo "não medido" pequeno ao lado do 0). Manter a coerência com a frase: "0 de 7" nunca deve parecer "zero medido": usar o mesmo marcador de "não medido" (hachura) e não a caixa "0" do zero medido.

Zero "corrige" aberto. Este é o único bloqueio.

## Melhorias (não bloqueiam)

1. **Erro, canal:** a mesma célula diz "7 de 7" enquanto a tela diz que a origem não foi lida. Defensável (o número vem do calendário de coleta, não da leitura), mas "—" seria mais honesto. Fazer junto com o B1-r3.
2. **Revisão, termos e sites:** com a origem "em revisão" (soma passou do total), o bloco de termos ainda usa "as 256 views da pesquisa" (vídeo) vindas dessa mesma origem. A NOTAS diz que os outros blocos têm conta própria; vale uma frase no ⓘ de termos dizendo que a comparação com a pesquisa fica suspensa em revisão, ou esconder só a barrinha "com termo / sem termo".
3. **Magro, rodapé da origem:** "Só as 14 dos dias medidos têm origem" soa ao contrário do que a frase acima diz (o YouTube deu origem para 5 das 14). Trocar por "Só 5 das 14 views dos dias medidos têm origem" ou cortar a segunda frase.
4. **Tabela de referência na revisão:** legenda "(origem em revisão, canal, 7)" sem "dias" nas outras (90, "7 dias" no cartão). Uniformizar.
5. **Cor repetida (dúvida 8) e três cartões de um matiz só (sug. 3 da r2):** continuam como perguntas ao dono, com o padrão "aceitar" declarado e o ⓘ avisando. Não bloqueiam. Em escala de cinza, pesquisa, sugeridos e início ficam próximos; símbolo e ordem fixa separam.

## Tabela de medidas

| Item | Medida | Limite | Resultado |
|---|---|---|---|
| Rolagem horizontal, 33 casos x 4 cruzamentos | 0 px em todos; 0 elementos além da largura | 0 | ok |
| Texto abaixo de 12 px | 0 em todos | 0 | ok |
| Contraste de texto composto (3.700+ trechos), pior caso por tema | escuro 4,86 (data "05/10 a 11/10", só leitura), 5,24 nos demais; claro 4,73 ("seu canal", componente aprovado), 4,94 no cartão | 4,5 | ok, nenhum trecho abaixo de 4,5 |
| Contrastes de fatia (r2, sem alteração de cor desde então) | mínimo 4,43 (externo, claro) | 3,0 | ok |
| Alvo a 390 px: seletor de período, ⓘ, "Tentar de novo", migalha | 44 x 44 (migalha 49 x 44) | 44 | ok; 0 alvos abaixo de 44 em 390 px |
| Alvo a 1440 px: seletor 44 de altura; ⓘ compacto 28 x 28; migalha 41 x 20 | convenção do produto (ponteiro fino) | | ok pela convenção |
| Foco visível, Tab (40 passos, 1440 e 390) | outline sólido 2 px em todos; ordem visual correta | 2 px | ok |
| ⓘ: Enter abre, Esc fecha, foco volta ao botão | sim, nas duas larguras | sim | ok |
| `aria-label` dos 6 ⓘ | "Como a origem é calculada", "...as impressões por origem são calculadas", "...termos e sites...", "...o aparelho...", "...o país...", "...inscritos e não inscritos..." | gramática | ok |
| `aria-label` das barras no magro | só números dados pelo YouTube; sem "0% (0)" | só o que o YouTube deu | ok (B1 da r2 resolvido) |
| `aria-label` da régua | "8 de 4.205 dias" | mesmo formatador da tela | ok (C8 resolvido) |
| Tabela de referência, 10 estados | some em não medido, erro, sem dado, carregando; revisão mostra a soma que passou; os demais "fecham" e conferem | coerente com a tela | ok (C7 resolvido) |
| `color-mix()` na interface | 0 regras nas folhas de estilo (as ocorrências restantes são só comentários) | 0 | ok |
| Erros de página no console | 0 | 0 | ok |
| Célula "dias com origem medida" no não medido (canal) | 7 de 7 | 0 de 7 | **falha (B1-r3)** |

## O que não consegui verificar

- Leitor de tela real (VoiceOver, NVDA): li só papéis e rótulos no DOM.
- Safari e Opera (navegador do dono): só Chromium. Hachura, pontilhado e listrado (`repeating-linear-gradient`, `radial-gradient`) não foram vistos no Opera; `color-mix()` está ausente.
- Toque real: `hasTouch` não ativa `pointer: coarse`; os 44 px a 390 px vêm da regra por largura e batem.
- Contraste de texto sobre hachura: a medição de fundo ignora o desenho do gradiente; nenhum texto do mockup fica sobre a hachura (rótulo "não medido" e frases ficam em fundo liso, conferido nas capturas).
- Dado real: tudo é exemplo.

## Para a rodada 4

Reconferir só o B1-r3: `?estado=nao-medido&tela=canal`, célula do cabeçalho mostrando 0 de 7 (e a melhoria 1 junto, se feita). Com ele corrigido e nada novo aberto, "pronto para o dono".
