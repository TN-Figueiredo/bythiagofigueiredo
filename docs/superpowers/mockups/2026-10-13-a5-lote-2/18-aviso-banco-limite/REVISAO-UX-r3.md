# Revisão de UX, mockup 18 (aviso "banco chegando ao limite"), rodada 3

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Escopo: conferir se N1, N2 e N3 da r2 foram resolvidos e se o ajuste criou defeito novo. Medi no Chromium headless sobre servidor estático próprio (portas 47741 e 47742, encerrado ao terminar; nada na 3099, sem specs do projeto). Refiz TODAS as capturas: 18 variantes x 4 cruzamentos = 72 em `shots/r3/`, com `medidas-r3.json`. Nada foi editado fora deste arquivo e de `shots/r3/`.

## Veredito: PRONTO PARA O DONO (zero bloqueio, zero "corrige")

Pergunta de quem abre: "o banco vai me deixar na mão, e quando?". Em 3 segundos, sem rolar e sem abrir dica: a pastilha na faixa diz "Banco: 216 de 500 MB" com minibarra e símbolo; em alerta, a borda e o símbolo mudam de forma (triângulo, octógono); sem leitura e erro, a hachura rosa diz "não sei" e nunca "está bem". Funciona.

## Conferência dos itens da r2

| Item r2 | Situação | Evidência medida ou vista |
|---|---|---|
| N1 quadro tracejado vazio com "+ novo" quando fechado (bloqueava) | resolvido | Painel fechado: `#bl-wrap` com `hidden` e `#bl-painel` não visível (altura 0) nos 24 cruzamentos fechados (6 variantes x 4). Único `.c2-novo` visível é o da pastilha (33 px a 1440, 49 a 58 px a 390). Capturas `verde-1440-escuro.png` e `verde-390-claro.png`: entre as abas e a Lista de Canais não sobra nada, e a Lista começa logo abaixo das abas. |
| N2 sem a marca "exemplo" fechado (corrige) | resolvido | `.ex` visível: 1 com painel fechado (na faixa, ao lado da pastilha), 2 com painel aberto (faixa e painel), 0 só em "só leitura" (onde não há pastilha, correto). A 390 a marca cai para a linha de baixo da faixa, dentro da caixa, sem rolagem. |
| N3 zero medido, previsão não medida e lote pendente fechados idênticos ao verde (corrige) | resolvido | Os três abrem o painel por padrão na mostra. MD5 das capturas 1440 escuro: verde `fe0e6010`, zero medido `82171eb1`, previsão não medida `51357112`, lote pendente `ebd2ea8a`, todos diferentes. Vi as três: zero medido mostra a caixa vazada "0,0 MB" (cinco lugares) sem nenhum rosa; previsão não medida mostra "Poucos dias de leitura: faltam 8 dias", 6 de 14 casas e a pastilha rosa "não medido" só na previsão; lote pendente mostra a pastilha "2 lotes a confirmar" e os dois cartões. |

O ajuste não criou defeito novo. Conferido por interação (teclado, 1440): Enter na pastilha abre o painel e o invólucro juntos, `aria-expanded` vai a `true`, `aria-controls` aponta para um elemento existente; ⓘ do painel abre o popover com o método ("O que é... medido uma vez por dia, às 05:00..."), Esc fecha e devolve o foco ao próprio botão; em "Com folga" a escolha é lembrada ao recarregar (aberto fica aberto, fechado fica fechado); zero medido segue abrindo por padrão sem gravar a escolha.

## Veredito por estado e por largura

Todos medidos nos quatro cruzamentos (1440 e 390, escuro e claro). Par obrigatório visto por mim nas capturas: verde, zero medido e previsão não medida (390 claro), lote pendente e zero medido (1440 escuro). Os demais estados não mudaram de código nesta rodada (r2 já os aprovou) e conferi só por medida.

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| verde (216), fechado | pronto | pronto | N1 e N2 resolvidos; também medido aberto (398 / 911 px) |
| zero medido | pronto | pronto | vazada "0,0", distinta do rosa; 420 / 947 px |
| previsão não medida | pronto | pronto | 6 de 14 dias, faltam 8, "passa a existir em 21/10" |
| lote pendente | pronto | pronto | chip "2 lotes a confirmar" (415 px a 1440; 53 px de altura a 390) |
| amarelo (360) | pronto | pronto | também fechado: pastilha com "limite em set/2028" |
| vermelho por tamanho (440) | pronto | pronto | também fechado |
| vermelho por previsão (392) | pronto | pronto | chip 53 px a 390, inteiro |
| acima do limite (521) | pronto | pronto | |
| sem leitura hoje | pronto | pronto | também fechado: hachura, nunca verde |
| erro ao ler | pronto | pronto | "Tentar de novo" mantido |
| ainda sem medida | pronto | pronto | |
| só leitura (não vê) | pronto | pronto | nenhum `#bl-chip` no DOM; desvio da regra 13 declarado ao dono |

## Bloqueios

Nenhum.

## Corrige

Nenhum.

## Melhorias (não bloqueiam)

1. **Régua do tempo em estado calmo (repetida da r2):** a zona vermelha de 90 dias continua em vermelho cheio em "Com folga" e "Zero medido" (visível em `sem-crescimento-1440-escuro.png`, a faixa vermelha à esquerda da régua) e é o bloco mais forte da tela mesmo sem risco. Contorno e listras sem preenchimento cheio quando não há data prevista ou ela é distante.
2. **Acima do limite:** "21 MB acima" só existe em texto; um tracinho além da borda direita da barra desenharia a ultrapassagem.
3. **Barra em "erro" e "vazio":** zonas âmbar e vermelha em saturação cheia, enquanto a frase diz que nada indica nem bem nem mal; baixar a opacidade.
4. **"exemplo" a 390 px:** fica sozinho numa linha abaixo da pastilha (ver `verde-390-claro.png`). É só mostra e não vai à produção; se incomodar o dono, pode ir na linha da pastilha.
5. **Âmbar e laranja de "seu canal" no tema claro** continuam parecidos (herança dos tokens do lote 1); só avisar o dono.
6. **Motivo repetido** em "previsão não medida" (6 dias na frase, no sub do número e na régua).

## Tabela de medidas (72 cruzamentos)

| Medida | Resultado |
|---|---|
| Rolagem horizontal | 0 px em todos os 72 |
| Texto menor que 12 px | nenhum |
| Alvos de toque a 390 (chip, ⓘ, "Tentar de novo", escolhas do seletor) | nenhum menor que 44 x 44; chip 44 a 53 px de altura |
| Alvos a 1440 (ponteiro fino) | chip e ⓘ de 28 px, permitidos pela convenção |
| Pior contraste de texto da pastilha e do painel (mínimo 4,5:1) | 5,59 (vermelho, escuro), 5,90 a 6,16 (vermelho, claro), 6,18 (lote, escuro), 6,64 a 6,83 (demais); fechado verde 14,48 / 15,76. Nenhum texto reprovado em nenhum cruzamento |
| Elementos gráficos (3:1) | sem mudança de CSS desde a r2: zona âmbar 3,40 / 3,42, zona vermelha 3,53 / 3,93, preenchimento verde 8,13 / 5,74 (escuro / claro) |
| Foco visível | 2 px sólido laranja (rgb 255 130 64) na pastilha |
| Painel fechado: quadro vazio | 0 px (era 22 px na r2) |
| Alturas do painel aberto (1440 / 390) | iguais às da r2: verde 398 / 911, zero medido 420 / 947, previsão não medida 396 / 880, lote 602 / 1222, sem leitura 299 / 643, erro 327 / 695, vazio 319 / 663 |
| `color-mix` no CSS que carrega a interface | nenhum (só em comentários que dizem "sem color-mix") |
| Erros de console | 1 por página: recurso externo (fonte) bloqueado de propósito na captura |

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): só li `aria-expanded`, `aria-controls`, `role` e `aria-label` no DOM e pela interação.
- Safari e Opera (o navegador do dono renderiza `color-mix()` transparente): confirmei só a ausência no CSS.
- Toque em dispositivo real (emulação de toque no Chromium).
- Movimento reduzido: li o CSS, não gravei a transição.
- Fontes da web (Fraunces, Inter, JetBrains Mono): bloqueadas na captura; larguras reais podem diferir poucos pixels.
- Escala de cinza: não refiz nesta rodada; o desenho das zonas e dos símbolos não mudou desde a r2, que a conferiu.
- Abri 5 das 72 capturas; o restante conferi por medida e pelo MD5.
