# Revisão Naksu, peça 4 (interruptor do automático), rodada 1

Commit b56494d4e. Arquivos: `19-mes-fora-do-banco/interruptor.html`, `interruptor.js`, bloco `.m-auto*` de `m19.css` (L277-301), peça nos cartões de `arquivo.html`. Capturas e medidas em `revisao-naksu-shots/peca4-1/` (`medidas.json` tem toda a medição por quadro, tema e largura). Servidor 47702 derrubado; a 47701 não foi tocada.

## Veredito: VOLTA PARA AJUSTE (leve). Nenhum bloqueante. 3 "corrige", 5 sugestões.

Resumo: 1 tela (peça 4, em `interruptor.html` e nos 3 cartões de `arquivo.html`): volta para ajuste. Os 3 defeitos que mais pesam: (1) a frase de confirmação rejeita "automatico" sem acento e não diz por quê; (2) acessibilidade do botão "Ligar o automático" da janela (sem `aria-describedby`); (3) `.m-auto` é um terceiro contêiner de aviso, em vez de reusar `.m-faixa`.

## 1. O que a peça acerta (preservar)
- Estado por forma + cor: círculo pontilhado (desligado / ainda não dá / travado / já visto), triângulo âmbar (desligou sozinho, vence), visto (ligado), hachura rosa com "nada sai sozinho" (não medido). Em escala de cinza e a 390 px a leitura se mantém.
- Contraste: todo texto da peça mede 4,5:1 ou mais nos dois temas (menor: muted sobre painel âmbar, 5,43:1 escuro / 5,99:1 claro; texto principal sobre painel âmbar 12,7:1 / 13,2:1). Borda âmbar 1,5 px sobre o painel: 6,76:1 escuro / 3,95:1 claro (mínimo 3:1). Borda pontilhada `--dim` sobre `--bg`: 5,24:1 / 5,35:1. Foco `--accent` sobre painel âmbar: 5,89:1 / 4,15:1.
- Zero rolagem horizontal em 390 e 1440, nos 5 grupos de quadros e nas 3 variantes do Arquivo (`hs = 0` em todos os 32 casos medidos); caixa do ⓘ aberta a 390 px cabe (74 a 346 de 390).
- Alvos a 390 px: todos os botões e ⓘ com 44 px; chip `a.m-chip` 44 px. Fontes: menor texto 12,5 px (`p.k`, rótulo, `small`). Números em `.m-num` (mono, tabular).
- Janela de ligar: `role="dialog"`, `aria-modal`, `aria-labelledby="aT"`; foco inicial em "Cancelar" (certo para ação de peso); laço de Tab fecha (aOk, aIn, Cancelar, aOk); Esc fecha e devolve o foco ao botão que abriu (testado); ao confirmar, o foco vai para o painel novo (`tabindex=-1`); status por `role="status"`; input 16 px / 44 px a 390; maiúscula, minúscula e espaços duplicados aceitos; 1440: janela de 540 x 774 em tela de 900; 390: 358 x 868 de 900, com rolagem interna (scrollH 920 / clientH 741).
- Peças 1 a 3: mesma família (barra `.m-bar`, ⓘ `.m-ibtn`, `.btn`, caixa `.m-dlg`), nenhum `color-mix`, só hex/rgba literais. Os dois ícones novos (`pont`, `tri`, `nm`) reusam os existentes.

## 2. Achados

### C1. CORRIGE. Frase de confirmação sem acento é recusada em silêncio
Janela "Ligar o automático", 1440 e 390, claro e escuro. Medido: digitar `ligar automatico de leitura de hora em hora` mantém `aria-disabled="true"` e o status continua "Digite a frase para continuar." (captura `dialogo-errado-390-claro.png`). `norm()` só faz `toLowerCase` + espaços; a comparação é com a frase acentuada. Em teclado sem acento (celular, Mac em layout US) o dono fica preso sem saber o motivo.
Correção: em `norm()` e na `TIPO[t].frase`, comparar sem diacríticos: `s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim()`. Status quando o texto não bate e tem 5+ caracteres: "Ainda não bate com a frase. Maiúscula e acento não importam." (texto é do Logan; a regra é minha).

### C2. CORRIGE. Botão "Ligar o automático" da janela sem descrição, e ordem de foco contra a ordem visual a 390 px
Janela, 390, ambos os temas. (a) `#aOk` (`aria-disabled`) não tem `aria-describedby="aSt"`: leitor de tela anuncia "botão, indisponível" sem dizer o que falta; só o input aponta para `#aSt`. (b) A janela em si não tem `aria-describedby` (a regra) , aceitável, mas então o título precisa ficar. (c) A 390 px o `.m-dlg-a` vira `column-reverse` (m19.css L212): visualmente "Ligar" fica em cima e "Cancelar" embaixo, mas a ordem do DOM é Cancelar, Ligar; o Tab (medido: Cancelar, aOk) vai de baixo para cima (WCAG 2.4.3). É herança do diálogo das peças 1 a 3, então não é só desta peça.
Correção: `<button ... id="aOk" aria-describedby="aSt">`. Para (c), trocar `column-reverse` por ordem DOM igual à visual: botão principal primeiro no DOM, `order:2` no Cancelar só no desktop (`@media (min-width:821px){.m-dlg-a{flex-direction:row-reverse}}`), e registrar na regra transversal que vale para todos os diálogos; se quiser deixar para depois, declare a divergência em NOTAS.md.

### C3. CORRIGE. Valor solto: a frase a digitar usa estilo inline
`interruptor.js` (dlgLigar): `<b class="m-num" style="padding:2px 6px;background:var(--sunk);border:1px solid var(--border);border-radius:4px;user-select:all">`. Quatro valores soltos (2px 6px, 4px, user-select) fora do CSS. Vale também para `style="font-size:12.5px"` e `style="margin:0 0 14px"` no quadro.
Correção: classe `.m-frase{padding:2px 6px;background:var(--sunk);border:1px solid var(--border);border-radius:4px;user-select:all;overflow-wrap:anywhere}` em `m19.css` (o `overflow-wrap` evita estourar quando a frase de hora, 43 caracteres, quebra a 390: hoje quebra bem, mas só por acaso).

### S1. SUGESTÃO. `.m-auto` duplica `.m-faixa`
`.m-auto.am` = `.m-faixa.am` (borda 1,5 px `--warning`, fundo `--warn-subtle`), mas com padding `10px 12px` contra `10px 14px` e fundo base `--bg` contra `--surface` da faixa. É um terceiro jeito de fazer o mesmo aviso dentro do cartão. Reusar `.m-faixa` com a grade de ícone, ou declarar `.m-auto` como "faixa de cartão" e igualar padding a 14 px e fundo a `--surface`.

### S2. SUGESTÃO. Estado "ainda não dá para ligar" diz a mesma coisa três vezes
`painel-ind-390-escuro.png`: frase "Falta: 2 saídas ... (1 de 3) e 2 simulações ... (0 de 2)", depois as duas barras com "1 de 3" / "0 de 2", depois o parágrafo que explica os dois termos. A barra já desenha o que falta. Cortar o "(1 de 3)" e o "(0 de 2)" da frase (ficam na barra) ganha uma linha a 390 px. Texto é do Logan; a redundância visual é minha.

### S3. SUGESTÃO. Três estados diferentes usam o mesmo círculo pontilhado
Desligado (pode ligar), ainda não dá, travado pela configuração, comentários ("não existe aqui") e desligou-já-visto: todos `ic('pont')` + borda pontilhada `--dim`. A diferença está só no título. Aceitável porque cada um tem texto, mas "pode ligar" e "não pode ligar" são opostos. Sugestão: o "ainda não dá" e o "travado" ganham o cadeado de uma linha só se o dono achar que se confundem no teste; não bloqueia.

### S4. SUGESTÃO. Fechar a janela clicando no fundo descarta a frase digitada
`m.addEventListener('click', ... e.target === m ... fecha())`. Com a frase completa digitada, um toque fora (390 px, polegar) fecha tudo. Ignorar o clique no fundo quando o input tem valor, ou deixar só Esc e Cancelar.

### S5. SUGESTÃO. Frase e campo ficam no fim de uma lista de 15 linhas a 390 px
Janela a 390 px: scrollH 920 contra 741 visíveis; o campo está no fim e, com o teclado do celular aberto (visualViewport menor que 400 px), ele pode ficar sob o teclado. Não testei aparelho real. Se o Logan aceitar, deixar o campo e o status colados ao rodapé fixo (`.m-dlg-a`), com a lista rolando por cima. (Ordem do fluxo: Logan.)

## 3. Tabela de medidas

| Item | Claro | Escuro | Exigência |
|---|---|---|---|
| Texto `--text` sobre painel âmbar | 13,24 | 12,71 | 4,5 |
| `--muted` sobre painel âmbar (p.k) | 5,99 | 5,43 | 4,5 |
| `--muted` sobre `--bg` | 6,83 | 6,67 | 4,5 |
| Borda âmbar 1,5 px / painel | 3,95 | 6,76 | 3 |
| Borda pontilhada `--dim` / `--bg` | 5,35 | 5,24 | 3 |
| Foco `--accent` / painel âmbar | 4,15 | 5,89 | 3 |
| Borda neutra do painel (decorativa; o estado está no ícone e no texto) | 1,40 | 1,22 | sem exigência |
| Textos de todos os quadros (script, 8 telas x 2 temas x 2 larguras) | nenhum abaixo de 4,5 | nenhum abaixo de 4,5 | 4,5 |
| Menor fonte | 12,5 px | 12,5 px | 12 |
| Alvo a 390 px | todos 44 px | todos 44 px | 44 |
| Alvo a 1440 (ponteiro fino) | ⓘ 28, chip 28, botão 36 | igual | herdado das peças 1-3 (declarado) |
| Rolagem horizontal | 0 | 0 | 0 |
| Janela de ligar 1440 / 390 | 540x774 / 358x868 (tela 900) | igual | sem corte |
| Valores soltos | 4 no style inline da frase, 2 `style` extra | | 0 |

## 4. O que NÃO verifiquei
Leitor de tela (leio só a árvore de ARIA no código), Opera real (o CSS da peça não usa `color-mix`; conferi por leitura), aparelho real e teclado virtual, rede lenta. Texto longo foi testado só com as frases fixas dos 12 motivos (nenhum estouro); não há nome livre na peça para injetar. Chromium apenas.

## 5. Para o Logan (uma linha cada)
- "Ligar de novo" desabilitado pede uma simulação, mas o botão "Ver o que sairia" está uma tela abaixo; dizer onde.
- O ⓘ "Como desligar" mostra o nome da variável `OBS_ARQUIVO_AUTO_DROP`; avaliar se o dono precisa disso na tela.
- Com o automático ligado, o botão "Tirar fevereiro ..." continua com o mesmo peso (`.btn.heavy`) do "Ligar o automático…": dois botões pesados com consequências diferentes no mesmo cartão.

Acordo: dou "pronto para o dono" quando C1, C2 e C3 estiverem aplicados; as sugestões ficam à escolha de quem desenhou, com a razão por escrito se recusadas.
