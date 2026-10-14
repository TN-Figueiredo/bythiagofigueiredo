# 18-v2: aviso do banco, versão da fase de manutenção (M4, peça 5)

Arquivos NOVOS nesta pasta: `18-v2.html`, `bl2.js` (cópia de `bl.js` com as mudanças), `bl2.css` (só acrescenta; usa `bl.css`). Nenhum arquivo do 18 aprovado foi editado; `index.html` abre igual. Capturas em `shots/18-v2-*` (1440 e 390, claro e escuro). Abrir: `18-v2.html?caso=v2`. Selo: ajuste de mockup aprovado: 18, 13/10/2026. Só hex e `rgba()` literais; a faixa âmbar-vermelho é `linear-gradient` entre dois hex.

## Estados (barra "Estados do mockup")
V0 antes da 1ª cópia, V1 com folga, V1a cópia atrasada (12 dias, âmbar; 34 dias, vermelho), V1n cópia não medida, V2 chega a 78% antes da saída, V3 70%+ com meses prontos, V4 alívio depois do aperto, V5 85%+ "O que libera espaço", V6 depois de uma saída, V7 vídeos antigos no arquivo, V8 casa não responde (64 h e 20 h), V8a sem a pausa da coleta, V8b NAS fora, V8c NAS cheio, V9 sem leitura hoje, V10 séries não medidas, V11 chip do automático, V12 canais removidos (12, 34 e 64 dias), V12n sem o comando (marca não desenhada). Mais os 12 do 18 ("Do 18 aprovado, inalterados": mesmo número e cor de antes, só a linha da cópia nova com "A primeira cópia é a de outubro, a partir de 28/11"). Painel aberto em todos os V. Cada V tem a sua data de "hoje" (fev/2027 na maioria).

## O que mudou e por quê
- **Cor da pastilha e da frase** = o mais alto que o banco chega antes da próxima saída (V2: 66% hoje, pastilha âmbar); a barra continua na cor do tamanho de hoje. V6 não fica verde porque ainda chega a 72%.
- **Barra** (C9): segundo marcador vazado, tracejado, com texto visível "chega a 78% antes da próxima saída" (não só `title`), na cor e na forma de quem manda na pastilha.
- **Régua** (C8): losango "chega a 85%" e traço "o próximo mês fica pronto", cada um com a data embaixo ("85% em 26/04", "novembro pronto em 16/05"); entre os dois, faixa âmbar a vermelho com listras e a frase "O alívio chega depois do aperto: 20 dias…". Só desenhada nos estados com próxima saída conhecida (V2, V4 a V6, V8x…); os 12 do 18 mantêm a régua do 18.
- **Linha da cópia** (C7), cinco estados com forma: antes da 1ª cópia (pontilhado neutro), em dia (visto, cinza), atrasada (triângulo âmbar até 30 dias, octógono vermelho acima; porta "Abrir o Arquivo"), não medida (hachura rosa; nunca o visto).
- **11.7**: "Quem ocupa" ganha a sub-linha recuada "Outubro, fora das telas, espaço ainda não liberado: 9%" (pontilhado neutro; parte de Concorrentes, não soma de novo). O mesmo mês é a PRIMEIRA linha em "O que libera espaço" (V5) e na linha da cópia com 70% ou mais (V3).
- **V8** (C8): frase-resumo + "O que fazer:" em lista de três itens; octógono vermelho a partir de 36 h sem resposta, triângulo abaixo (o limite de 36 h fica no ⓘ); V8a troca o 3º item por "A pausa da coleta de canais ainda não existe".
- V5: nenhuma linha fala em plano pago; V10: pastilha "Não medido", sem número parcial. V11 e V12: chips AO LADO da pastilha, borda neutra literal, texto `--text`; a forma diz a gravidade (caixa de arquivo cinza, triângulo aos 30 dias, octógono aos 60).
- O ⓘ foi reescrito (cópia mensal e sempre; cor pela próxima saída; limite de 36 h).

## O que o dono testa no Opera
V1 contra o 18 aprovado lado a lado; V2 (pastilha âmbar com 66%, sem a palavra "pico"); V4 (de longe, o losango vem antes do traço; a faixa aparece no Opera); V5 (lista sem plano pago); V6 (número cai, cor não fica verde); V8 a 390 px (a ação é um item, não parágrafo); V0, V1a e V1n (a linha da cópia nunca mostra visto sem dado).

## Em aberto
- As alavancas de reserva do V5 (6%, 11%, 3% por canal) são exemplo: o texto real vem da seção 8.4 do spec 01, que não li.
- V5: com o losango em "já passou", o traço quase cola em "hoje" na régua; legível, mas apertado.
- Tabela de coerência por estado (lida do DOM, `window.BL`) não foi refeita ainda.

## Rodada 2 (14/10/2026): correções da Naksu (V2-1 a V2-4)
- V2-1: "chega a N% antes da próxima saída" tem `width:max-content` e no máximo min(230 px, 100vw - 48 px) a 390 px: duas linhas (230 x 32 px) em V2, V4 e V6, sem cobrir a legenda.
- V2-2: os rótulos centrados da régua ("novembro pronto em ...") são presos à régua por `prende()` em `bl2.js`; nenhum sai da tela (V2: left 28 px).
- V2-3: no tema claro, "Abrir o Arquivo" sobre âmbar/vermelho usa `--accent-hover` (#A23E14, 5,34:1).
- V2-4: V9 mostra Exportações como "não medido" ("e a leitura de hoje não chegou: não dá para dizer se alguma espera confirmação"), como o V10; nunca "0 exportações" sem leitura. Vale também para o caso `sem-leitura` desta versão (o 18 aprovado não foi tocado).
- Medido de novo em V1a, V1b, V2, V4, V5, V6, V9 (390 e 1440, claro e escuro): zero `color-mix`, rolagem horizontal 0, alvos < 44 px = 0, contraste < 4,5:1 = 0. Capturas regravadas em `shots/`.

## Rodada 3 (14/10/2026): V-N1 da Naksu
- O rótulo "90 dias" da régua ganhou `background:var(--surface);padding:0 3px;z-index:2` (`bl2.css`, fim do arquivo): o traço de "o próximo mês fica pronto" não o corta mais a 390 px (V2, V4, V6). O 18 aprovado não foi tocado. Medido de novo a 390 e 1440, claro e escuro: rolagem horizontal 0, zero `color-mix`, alvos abaixo de 44 px a 390 = 0; capturas `18-v2-caso-v2|v4|v6-*` regravadas.
