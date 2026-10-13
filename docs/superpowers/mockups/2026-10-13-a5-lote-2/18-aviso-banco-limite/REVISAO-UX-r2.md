# Revisão de UX, mockup 18 (aviso "banco chegando ao limite"), rodada 2

Revisor: `revisor-ux-senior`. Data: 13/10/2026. Escopo: conferir se cada bloqueio e cada "corrige" da r1 foi resolvido e se o ajuste criou defeito novo. Medi no Chromium headless sobre servidor estático próprio (portas 47727 a 47732, encerrado ao terminar; nada na 3099, sem specs do projeto). Capturas minhas em `shots/r2/` (par obrigatório 1440 escuro e 390 claro dos 12 estados, mais painel aberto dos três estados calmos e as variantes de painel fechado; `medidas-r2.json` com as 60 medidas). Nada foi editado fora deste arquivo e de `shots/r2/`.

## Veredito: VOLTA PARA AJUSTE (não vai ao dono)

Todos os sete itens da r1 (B1 a B3, C1 a C5) estão resolvidos, medidos e vistos. O ajuste do B3 (painel fechado nos estados calmos) criou um defeito novo, visível na tela mais comum (verde), e dois problemas de mostra. Resultado: **1 bloqueia e 2 corrige**. Regra do rito: nenhum mockup vai ao dono com "bloqueia" ou "corrige" aberto. São três correções pequenas, nenhuma muda o desenho.

Pergunta de quem abre: "o banco vai me deixar na mão, e quando?". Em 3 segundos: em vermelho por previsão a pastilha e a frase dizem "enche em 80 dias"; no amarelo a pastilha diz "limite em set/2028"; sem leitura e erro, a hachura rosa e "sem leitura hoje" / "não foi possível ler" dizem que não se sabe, sem tranquilizar. A resposta de relance funciona.

## Conferência dos itens da r1

| Item r1 | Situação | Evidência medida ou vista |
|---|---|---|
| B1 zonas da barra não liam em cinza | resolvido | Símbolo (triângulo, octógono) dentro de cada zona, traço de 3 px no topo, listras na vermelha. Zona contra trilho: 3,40 e 3,53 (escuro), 3,42 e 3,93 (claro), acima dos 3:1. Zona âmbar contra vermelha continua 1,04 (escuro) e 1,15 (claro), mas em escala de cinza a barra se lê pelos símbolos e pelas listras (`shots/r2/` convertido em cinza, ambos os temas). |
| B2 parede de "não medido" e frase sobre o próprio aviso | resolvido | Pastilhas "não medido" no painel aberto: 2 em sem leitura, erro e vazio (eram 7 e 8). Régua e "Quem ocupa" só com hachura. Frase não diz mais "com folga" nem "não pode ficar verde". |
| B3 painel aberto à toa | resolvido, mas criou o defeito N1 | Fechado em verde, zero medido, previsão não medida e lotes; aberto nos demais. Lista de Canais começa em y 448 (1440) e 543 (390) nos calmos, contra 846 a 866 e 1186 a 1477 nos abertos. Escolha lembrada só nos calmos: testei (Enter abre, recarrega aberto; nos de alerta recarrega sempre aberto). |
| C1 pastilha do painel sem símbolo | resolvido | A amostra de hachura aparece na pastilha (sem leitura, erro, vazio), vista nas capturas. |
| C2 pastilha da faixa quebrava a 390 | resolvido | "Banco: N de 500 MB" não quebra em nenhum estado; chip de 44 px (verde, vermelho por tamanho, acima, sem leitura, erro, vazio) e 53 px quando há segunda linha ("limite em set/2028", "enche em 80 dias", "2 lotes a confirmar"), todas inteiras. |
| C3 nomes quase iguais | resolvido | "Com folga" < "Enchendo" < "Quase cheio" / "Enche em 80 dias" < "Acima do limite". Aparece igual em pastilha, frase, legenda, ⓘ e tabela fora da tela. |
| C4 número repetido | resolvido | Cortadas as células "Hoje" e "Chega a 500 MB"; sobram "Livre até 500 MB" e "Cresceu em 28 dias". |
| C5 frase do vermelho por previsão | resolvido | "Banco enche em 80 dias: 392 de 500 MB (78%), no ritmo dos últimos 28 dias." Uma frase; a data fica na régua. |
| Sugestões 1 a 11 | feitas, exceto a 10 (declarada) | Tabela a 390 sem quebra; "Tentar de novo" ao lado da frase com `aria-live="polite"` (testei: espera, `aria-busy`, resultado anunciado); lotes aparecem no erro; jargão trocado. |

## Veredito por estado e por largura

Par obrigatório: 1440 escuro e 390 claro. Medi também 1440 claro e 390 escuro (rolagem, alvos, fontes, contraste). Painel aberto dos estados calmos: capturado por mim, o que o desenhista não tinha.

| Estado | 1440 escuro | 390 claro | Observação |
|---|---|---|---|
| verde (216) | volta | volta | N1 (quadro vazio), N2 (sem "exemplo") |
| amarelo (360) | pronto | pronto | contas fecham: 140 ÷ 0,20 = 700 dias = set/2028; soma 5,6 |
| vermelho por tamanho (440) | pronto | pronto | 60 ÷ 0,30 = 200 dias = mai/2027 |
| vermelho por previsão (392) | pronto | pronto | 108 ÷ 1,35 = 80 dias = 01/01/2027; 158,0 + 120,4 + 113,6 = 392; 40 + 31 + 29 = 100 |
| acima do limite (521) | pronto | pronto | "21 MB acima"; ver sugestão 2 |
| zero medido (não cresceu) | volta | volta | N1, N2, N3: fechado é idêntico ao verde; aberto está correto (caixa vazada "0,0" em cinco lugares, distinta do rosa) |
| previsão não medida (6 dias) | volta | volta | N1, N2, N3; aberto está correto (6 de 14 casas, "faltam 8 dias", 21/10 = 13/10 + 8) |
| sem leitura hoje | pronto | pronto | nunca verde; última leitura 12/10, 215 MB; hachura na pastilha, na barra, na régua |
| lote pendente | volta | volta | N1, N2; a pastilha traz "2 lotes a confirmar" e é o único calmo que se distingue de verde |
| erro ao ler | pronto | pronto | "Tentar de novo" ao lado da frase; resultado em região viva |
| ainda sem medida | pronto | pronto | "Antes disso não existe dado, e isso não é 0 MB"; 14/10 + 13 dias = 27/10 |
| só leitura (não vê) | pronto | pronto | nenhum `#bl-chip` no DOM; desvio da regra 13 declarado (dúvida 1 do dono) |
| painel fechado (amarelo, vermelho, sem leitura) | volta | volta | N1 |

## Bloqueios (impedem ir ao dono)

### N1. Painel fechado deixa um quadro vazio tracejado com a etiqueta "+ novo" na tela (bloqueia)
- **Onde:** todo estado fechado, ou seja, o padrão de verde, zero medido, previsão não medida e lote pendente, e as variantes "Fechado" de amarelo, vermelho e sem leitura; 1440 escuro e 390 claro. Capturas: `shots/r2/verde-1440-escuro.png`, `shots/r2/lote-pendente-390-claro.png`.
- **O que está errado:** o ajuste do B3 esconde o painel (`.bl[hidden]`) mas deixa o invólucro `L.novo(..., 'bl-n')` na tela: um retângulo tracejado verde-água de 22 px de altura (1440: 1168 x 22 px; 390: 350 x 22 px) com "+ novo" e nada dentro, entre as abas e a Lista de Canais. Parece tela quebrada, e é o primeiro que o dono vê no estado mais comum (verde, que é o padrão do mockup). A pastilha na faixa já é o acréscimo; o quadro vazio não diz nada.
- **Conserto exato:** em `bl.js`, esconder o invólucro e não só o painel. O `click` da pastilha passa a alternar `pn.parentElement.hidden` (o `.bl-n`) além de `pn.hidden`; na criação, `painelAberto ? '' : ' hidden'` vai também no wrapper (por exemplo, pôr a classe `.bl-n[hidden]{display:none}` em `bl.css` e passar `hidden` ao `L.novo`). Reconferir que o ⓘ continua funcionando com o painel aberto (os popovers ficam dentro do invólucro).

## Corrige (vão ao dono só depois de corrigidos)

### N2. Com o painel fechado não há a marca "exemplo" em lugar nenhum (corrige)
- **Onde:** os mesmos estados fechados; 1440 escuro e 390 claro.
- **Errado:** regra 12 do lote: todo número de exemplo leva a marca. A marca vivia só no painel (`.bl-pw .ex`); fechado, "Banco: 216 de 500 MB" aparece sem marca (medi: nenhum `.ex` dentro da faixa). O dono pode ler 216 MB como dado real.
- **Conserto:** acrescentar `<span class="ex">exemplo</span>` ao lado da pastilha na faixa (mockup apenas), igual à do painel.

### N3. Zero medido e previsão não medida, fechados, são idênticos ao verde: o dono não vê o estado que vai julgar (corrige)
- **Onde:** estados "Zero medido" e "Previsão não medida" no seletor; 1440 e 390.
- **Errado:** as capturas `index-caso-sem-crescimento-1440-escuro.png`, `index-caso-projecao-nm-1440-escuro.png` e `index-caso-verde-1440-escuro.png` têm o mesmo MD5 (`ef7182a3...`): três estados, uma imagem. A distinção que o dono mais cobra (zero medido x não medido) só existe com o painel aberto, e nenhuma captura entregue mostra isso. Sem clicar, ele aprova uma tela em branco.
- **Conserto:** no seletor do mockup, abrir por padrão o painel dos estados "Zero medido", "Previsão não medida" e "Lotes a confirmar" (`painelAberto` verdadeiro quando `caso` for um deles e não houver `?painel=`), mantendo o padrão fechado só em "Com folga"; e refazer as capturas desses três estados com o painel aberto. O comportamento de produção (fechado nos calmos) não muda; só a mostra.

## Sugestões (não bloqueiam)

1. **Régua do tempo em estado calmo:** a zona vermelha de 90 dias (24,7% da régua, vermelho saturado) é o bloco mais forte da tela em "Com folga" e em "Zero medido". Considerar a zona só com contorno e listras (sem preenchimento cheio) quando não há risco.
2. **Acima do limite:** a barra pinta tudo de vermelho e as duas zonas somem no preenchimento (só ficam os símbolos e o traço de 3 px). Funciona, mas "21 MB acima" só existe em texto; um tracinho além da borda direita da barra desenharia a ultrapassagem.
3. **Barra em "não medido":** as zonas âmbar e vermelha ficam com a saturação cheia em "erro" e "vazio", onde a frase diz "nada indica que está tudo bem nem que está ruim". Baixar a opacidade das zonas nesses dois estados.
4. **Cor no tema claro:** o âmbar do preenchimento (`#B45309`) e o laranja de "seu canal" (`#B8481A`) ficam quase iguais lado a lado no painel claro (amarelo e vermelho por previsão). A legenda e a posição os distinguem, mas é o mesmo castanho em dois significados; é herança dos tokens do lote 1, só avisar o dono.
5. **Motivo repetido:** em "previsão não medida" os "6 dias de leitura" aparecem na frase, no sub do número e na régua; em "sem leitura", o motivo aparece em três linhas com palavras diferentes. Aceitável, mas um dos lugares pode sair.
6. **Fonte da web:** bloqueada na captura (como no lote 1); larguras reais podem diferir poucos pixels.

## Tabela de medidas

Contraste de texto (mínimo exigido 4,5:1). Rodei sobre todo texto da pastilha e do painel nos 11 estados com painel aberto, 1440, dois temas: nenhum abaixo de 4,5. Textos "não medido" (cor `--nm` sobre a hachura, pior listra): 5,13 (escuro) e 5,47 (claro). Maior risco anterior (pastilha vermelha, 5,59 escuro) sem mudança.

Elementos gráficos (mínimo 3:1):

| Elemento | Escuro | Claro | Passa |
|---|---|---|---|
| zona âmbar contra trilho | 3,40 | 3,42 | sim |
| zona vermelha contra trilho | 3,53 | 3,93 | sim |
| preenchimento verde contra trilho | 8,13 | 5,74 | sim |
| traço âmbar do topo contra trilho | 8,62 | 4,24 | sim |
| traço vermelho do topo contra trilho | 6,25 | 5,55 | sim |
| zona âmbar contra zona vermelha | 1,04 | 1,15 | não, mas lidas pelo símbolo e pelas listras (cinza conferido) |

Rolagem horizontal: 0 px nos 60 cruzamentos (15 variantes x 4). Texto menor que 12 px: nenhum. Alvos a 390: nenhum menor que 44 x 44 px (chip 44 a 53 px, ⓘ, "Tentar de novo"); a 1440 chip de 28 px e ⓘ compacto de 28 px, permitidos pela convenção (ponteiro fino).

Alturas do painel aberto (1440 / 390): verde 398 / 911; amarelo 398 / 911; vermelho por tamanho 418 / 934; vermelho por previsão 398 / 888; acima 398 / 888; zero medido 420 / 947; previsão não medida 396 / 880; sem leitura 299 / 643; lote pendente 602 / 1222; erro 327 / 695; vazio 319 / 663. Quadro vazio quando fechado: 22 px (1440 e 390).

Teclado e aria (medido): ordem de foco pastilha, ⓘ do banco, "Tentar de novo" (no erro), ⓘ dos lotes, lista; foco com 2 px laranja visível em todos; Enter alterna o painel e `aria-expanded` acompanha (`aria-controls="bl-painel"` existe); ⓘ abre popover e Esc fecha devolvendo o foco ao botão; barras e régua com `role="img"` e texto por extenso; retorno de "Tentar de novo" em `aria-live="polite"`.

`color-mix`: nenhum no CSS que carrega a interface (`bl.css`: 0; só comentários "sem color-mix" em `a4.css` e `lote.css`).

## O que NÃO consegui verificar

- Leitor de tela (VoiceOver, NVDA): só li os atributos de `aria` e `role` no DOM.
- Safari e Opera (o navegador do dono renderiza `color-mix()` transparente; confirmei só a ausência no CSS).
- Toque em dispositivo real (usei emulação de toque no Chromium).
- Movimento reduzido: li o CSS (`prefers-reduced-motion`), não gravei a transição.
- Fontes da web (Fraunces, Inter, JetBrains Mono): bloqueadas na captura.
- 1440 claro e 390 escuro: medidos (contraste, rolagem, alvos, fontes), mas só abri as capturas do par obrigatório.

## Condição para a próxima rodada

Corrigir N1, N2 e N3; refazer as capturas do verde, zero medido, previsão não medida e lote pendente (padrão do mockup) e conferir que o quadro tracejado vazio sumiu a 1440 e a 390 e que cada estado calmo difere dos outros. Zerados os três, não há outro item aberto: o veredito passa a "pronto para o dono".
