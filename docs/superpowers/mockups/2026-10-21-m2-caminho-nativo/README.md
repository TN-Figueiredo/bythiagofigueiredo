# Mockup M2 r2: caminho do teste do YouTube (21/10)

Abrir: `open -a Opera index.html`. Seletor no topo: **Estado** (agrupado), **Tema** e **Largura** (1440 ou 390). A URL aceita `?estado=<chave>&tema=dark|light&largura=1440|390` (mesmo padrão do M1), e `&motivo=incompleta|ja_ha_teste|estado_mudou|sem_conexao` no estado `ficha-erro`. Os botões funcionam: o clique leva ao estado seguinte. Dados sintéticos.

Base: cartão S7 r3 (tokens, selos, faixas, escala 4/8/12/16/24/32, Georgia nos títulos), sem identidade nova. Novos só `--vc` (versão C, valores da Naksu r2) e `--err` (texto de erro com ⚠). Nenhum `color-mix()`; só hex/rgba literais.

## r2: o que mudou (item dos pareceres de Logan e Naksu -> conserto)
Mantido: primário "Pausar e voltar a original"; "Abrir no Studio" só depois de restaurar (ambos aceitaram).

| Item | Conserto |
|---|---|
| Logan: ações da ficha fora da 1ª tela a 1440 (Abrir no Studio em y=1303, Já iniciei em ~1580) | A ação do estado fica logo abaixo da frase-resumo: "Abrir no Studio"; na volta do Studio, o bloco "Confirmar" (Já iniciei, Ainda não, 2º toque e erros) sobe para o topo. O passo 2 vira link "Abrir no Studio de novo". Ao abrir a ficha a 1440 a página rola até ela. Medido: ação a 244-448 px do topo da tela de 900 px em todos os estados |
| Logan: foco cai no body ao abrir a ficha; ficha muda a posição da linha | Foco no h2 da ficha (tabindex -1); a ficha ocupa o lugar da linha tocada, entre as mesmas vizinhas e na ordem da lista. Esc devolve o foco à linha |
| Logan: resumo da lista diz "um vídeo" mas são dois "Responder"; o laranja não está em quem espera resposta | Resumo "Dois vídeos esperam a sua resposta: um passou do prazo, um terminou hoje" com link que leva ao primeiro; grupo "Precisa de você" no topo (2 vídeos), "Outros vídeos" (9). Regra: laranja = o que mais precisa de você hoje; só o "Responder" do prazo vencido é primário, os demais botões da lista são secundários |
| Logan: Las Vegas pausado no S7 e não na lista; datas de Retomar sem regra | Mesma linha "Lab pausado... Retomar a partir de" na lista; resumo "pausado em dois"; regra única do spec: início + 14 dias + 2 de fechamento (Museu 18/10 -> 03/11; Las Vegas 19/10 -> 04/11, também no S7) |
| Logan e Naksu: "O YouTube indicou A" afirma mais que o dado | "No ar, lido pelo Lab em 05/10: A" / "Você disse: B"; título "No ar estava A; você disse B"; linha da lista "No ar está A; você disse B"; nota de que o Lab só lê o título no ar. Selo mantém "Respostas diferentes" |
| Logan: d14-derivada com duas perguntas e dois nomes | Uma pergunta ("Qual versão venceu no Studio?") e o rótulo "A (original) ficou" em todos os dias 14; a ressalva dos títulos vai para a linha de apoio |
| Logan: ficha-outro-aparelho manda ao computador o que já está lá; duas linhas de salvamento | A 390: "Para ligar o teste, termine no computador; aqui dá para revisar", sem "Lembrar no computador"; uma linha só ("Ficha feita em 21/10, 14:32") |
| Logan: ficha-offline contraditório | Escolhida a fila: botão habilitado, "o lembrete fica na fila e sai quando a conexão voltar" |
| Logan (sugestões): 13 dias sem data; "Começar outra ficha" joga fora; "Já iniciei" habilitado sem B | "Salvo em 08/10, 14:32"; "Começar outra ficha com estas versões"; "Já iniciei" desabilitado com "Falta a versão B" (o erro "incompleta" fica para a corrida de servidor) |
| Naksu C1: `opacity:.62` no contexto reprova (2,92 a 3,23:1) | Sem opacity: título em `--muted`, só a miniatura a .6, botões sem borda em `--muted` |
| Naksu C2: "Sem resposta" igual a "Resultado pronto" | Selo próprio `mute` com ampulheta e a palavra |
| Naksu C3: dois laranja em ficha-ja-iniciei | Com a confirmação aberta, "Já iniciei" fica secundário com borda de 2 px e `aria-expanded`; só "Confirmar" é laranja (o segundo toque no mesmo botão volta) |
| Naksu C4: três laranja na lista | Ver o resumo da lista acima: um só laranja por tela (medido: no máximo 1 em todos os estados) |
| Naksu C5: esqueleto com altura diferente | Altura medida: ficha 1306 -> 1306 (1440) e 1742 -> 1742 (390); lista 1525 e 2544, 11 linhas de esqueleto |
| Naksu C6: dia 14 a 4,30 e 4,26:1 | Fundo do bloco do dia 14 igual a `--surface` e selo verde sem fundo |
| Naksu C7 e S1: títulos iguais a 390; palavra sem espaço vaza | Versões do dia 14 em coluna a 390 com 4 linhas de título; `overflow-wrap:anywhere` em títulos |
| Fora do pedido, mesma meta | Texto do quadro explicativo no tema claro (contraste); frase de "ficha-studio-aberto" não repete a pergunta do bloco |
| Naksu S2 e S3 (chip C no escuro, ΔE da deuteranopia) | Sem mudança: a letra A/B/C acompanha sempre a cor (contrato do chip); divergência do chip fixo registrada, para decidir na implementação |

## Medido na r2 (Playwright headless, sem abrir o navegador do dono)
37 estados x 2 temas x 1440/390: nenhum erro de script; 0 textos abaixo de 4,5:1 (3:1 em texto grande), contraste calculado com o fundo real; sem rolagem lateral a 390 (também com título de 80 letras sem espaço); 0 botões ou links com menos de 44 px a 390; nada passa da borda do quadro; no máximo 1 botão laranja por estado. Capturas novas em `shots/` (20 estados x 2 temas x 2 larguras e `*-1a-tela.png` das fichas a 1440).

## Decisões aplicadas
- Direção acordada por Logan e Naksu (r2). Divergências decididas pelo brief: a ficha é um **painel na própria página**, no lugar da linha (até 880 px, uma coluna), tela cheia a 390, sem modal sobre modal. "Prefiro outro caminho" **some** em Short, kids, 18+ e estreia/live. "Decidir depois" não existe.
- Dia 14 (decisão do CHECK 3): um botão por versão, original incluída ("A (original) ficou" → `venceu_original`; "B venceu" → `venceu_nova`), mais Ficou igual, Inconclusivo e Não vi. **Sem primário**, ordem fixa.
- Nosso teste rodando: o primário do estado é **Pausar e voltar a original** (2 toques); **Abrir no Studio só aparece depois da original restaurada** (spec §6, como Logan; a Naksu preferia o botão sempre habilitado). A faixa "Lab pausado" com a hora fica na ficha.
- Já iniciei: 2º toque com a consequência escrita na própria ficha; erros no mesmo lugar (incompleta, já há teste, estado mudou, sem conexão).
- Cor = um significado: âmbar ⏸ Lab pausado; verde ✓ ficou no ar ou registrado; azul-acinzentado tracejado ▶ em teste no Studio, sólido ● resultado pronto; rosa hachurado ? não medido ou formato não confirmado; cinza — sem volume; laranja só no único primário. Cada selo se lê em cinza pelo símbolo e pela palavra.
- Um primário por estado; linhas de contexto ao redor da ficha ficam recuadas (título e miniatura mais claros, sem opacity) e sem primário.

## Estados (chave do seletor)
- Lista: `lista` (os 9 estados de linha mais "Sem volume"), `lista-carregando`, `linha-outro`.
- Ficha: `ficha-carregando`, `ficha-so-original`, `ficha-duas`, `ficha-tres` (título de 100 caracteres com emoji, C em 854 × 480), `ficha-so-titulo`, `ficha-so-miniatura`, `ficha-imagem-falhou`, `ficha-salvando`, `ficha-offline`, `ficha-outro-aparelho`, `ficha-studio-aberto`, `ficha-ja-iniciei`, `ficha-registrada`, `ficha-erro`, `ficha-ainda-nao`, `ficha-detectado`, `ficha-nosso-rodando`, `ficha-pausar-confirma`, `ficha-restaurando`, `ficha-restaurar-falhou`, `ficha-restaurada`, `ficha-lembrete`, `ficha-13d`, `ficha-15d`.
- Detalhe: `s7-detectado` (cartão S7 estado 1, sem redesenho, rótulos do glossário).
- Dia 14: `d14-duas`, `d14-tres`, `d14-derivada`, `d14-respondido`, `d14-original`, `d14-tardia`, `d14-conflito`.
- Avisos: `sino`, `email`.

## Como testar no Opera
1. `lista` nos dois temas: cada selo se distingue sem cor? A linha do Short não tem "Prefiro outro caminho"? Clique em "Prefiro outro caminho" e volte.
2. "Testar no YouTube" abre a ficha no lugar da linha; Esc ou Fechar voltam à lista com o foco no botão.
3. Na ficha: troque Título · Miniatura · Os dois; Abrir no Studio → Já iniciei vira primário → 2º toque → registrado.
4. `ficha-nosso-rodando`: Pausar (2 toques) → restaurando; `ficha-restaurada` mantém a faixa âmbar com a hora.
5. 390: o rodapé fixo "Lembrar no computador" e, em `ficha-lembrete`, "Lembrete enviado em 21/10, 14:40".
6. Dia 14 a 390 com 3 versões: cartões empilhados, alvos de 44 px; clique numa versão e em "Mudar minha resposta".

## Medido na r1 (histórico)
Nenhum erro de script; nenhum "undefined", "NaN" ou "null" no texto; nada passa da borda do quadro e a página não rola para o lado a 390; todos os botões visíveis a 390 com 44 px ou mais. 

## O que não entra
Opção por canal ("meu canal não tem"); "Desfazer" do Já iniciei; descartar ficha à mão; "Decidir depois"; modal de 900 px; primário ou "resposta provável" no dia 14; datas de salvamento na linha; "vencedor" para o teste do YouTube; número oficial do Studio, CTR, retenção; redesenho do S7 (D22); animação além do esqueleto.

## Não verificado
Rótulos e ordem reais do Teste e compare no Studio (inclusive se ele declara a original vencedora); Opera real (só Chromium headless); leitor de tela; deuteranopia entre `--vb` e `--vc` (por isso o chip sempre leva a letra); contraste de `--err` (medido pela Naksu: passa); o âmbar do selo "Resolução baixa" é o componente do M1 (segundo significado do âmbar, previsto no glossário §5).
