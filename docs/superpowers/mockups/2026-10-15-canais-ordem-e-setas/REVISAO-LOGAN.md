# Revisão do Logan (UX): mockup 17, Canais, ordem e setas (15/10/2026)

Verificado: `index.html` aberto por `file://` no Playwright, 1440 e 390 px, escuro; Inscritos crescente, Crescimento nos dois sentidos, Direção crescente a 390; contagem de linhas e textos da faixa lidos do DOM; foco por teclado (clique no cabeçalho mantém o foco nele; Esc no ⓘ devolve o foco ao ⓘ). Capturas na pasta temporária da sessão, não commitadas.
Fontes: fim de `.superpowers/sdd/a5/decisoes-do-dono.md` (15/10), `discussao-direcao/hanna.md`, `posicao-model.ts`, plano da A3 (decisão D3, linha 60), spec do observatório (pergunta 8 e emenda 45).

## Veredito: CORRIGE (1 tela, 3 consertos curtos; a estrutura fica)

Pergunta de quem abre: "Em que lugar estou e quem está subindo ou caindo?" Passos: ordenar por Crescimento ou Direção = 1 clique no cabeçalho (ou 1 toque na barra a 390); posição do dono em Inscritos/Views/dia = 0 passos (faixa). Conta boa, não aumentar.

## O que acerta (preservar)
- P numera toda ordenação; "sem medida" fica no fim, com traço e divisor, nos dois sentidos, nunca como zero.
- Crescimento sem seta e sem cor de direção; ▲▼ só na Direção; chevron de ordenação diferente das setas.
- Direção abre com quem mais sobe; `aria-sort` nos cabeçalhos; o foco fica no cabeçalho depois de ordenar.
- Os botões da faixa dizem o que fazem ("Ordenar por Inscritos").

## Achados

### 1. P recontado em ordem crescente contradiz a faixa e a convenção do produto. Severidade: corrige
- Tela e estado: Inscritos, crescente. Evidência medida: a linha "Meu Canal Exemplo" mostra **2º** na coluna P e a faixa, acima dela, diz **12º de 13**. Dois números para o mesmo canal na mesma tela.
- Por que falha: o spec (linha 854) e todas as frases de posição do produto definem "1º = o maior". Com a ordem invertida, "1º" passa a ser o menor. A posição deixa de ser propriedade do canal e vira número de linha; o mesmo canal muda de posição ao inverter o sentido.
- Custo: o dono lê "Estreia Tardia é 1º" e conclui que é o maior da lista; ou compara a faixa com a linha e desconfia de um dos dois.
- **Resposta à pergunta 1 (decisão): a coluna P mostra a posição canônica, 1º = o maior valor da coluna ordenada, em qualquer sentido.** O sentido crescente só inverte a ordem visual (13º no topo, 1º no fim). "Pela coluna ordenada" do dono continua cumprido: o número vem do valor da coluna em que ele ordenou. Vale também em Crescimento (1º = quem mais ganhou) e Direção (1º = quem mais sobe). Empate: numeração de competição calculada no sentido canônico, de modo que em crescente fica "11º, 10º, 9º, 6º＝, 6º＝, 6º＝, 5º...". A posição do dono na faixa e na linha passam a ser sempre a mesma.
- Implementar: em `ordena()`, calcular `pos` sempre sobre a lista em ordem decrescente do valor e só depois inverter a lista exibida quando `sentido === 'asc'`. Texto novo na linha de ordem, junto do ＝: "Posição: 1º é o maior valor, em qualquer sentido." No produto, `view-model` guarda a posição no canal (como já faz `posDono`), não no índice da linha.
- Alternativa que o dono pode preferir, declarada: recontar de 1º no topo. Eu não recomendo; se ele escolher, a faixa tem de sumir em ordem crescente ou dizer "11º de 13 nesta ordem" junto do 12º. Levar ao dono como pergunta de uma linha, com a recomendação acima.

### 2. O símbolo de empate "＝" é o mesmo da Direção "sem mudança". Severidade: corrige
- Tela e estado: Direção e Crescimento a 1440 e 390. Evidência: a linha Rio Abaixo mostra "6º＝" na coluna P e "＝ −3% sem mudança" na célula da Direção; a legenda da Direção traz "＝ sem mudança" e, na linha de cima, "＝ mesma posição: mesmo valor na tela".
- Por que falha: o mesmo glifo com dois sentidos na mesma linha. É a confusão que esta leva existe para desfazer (Crescimento e Direção com a mesma seta).
- Custo: o dono lê "empatado" como "sem mudança", ou o contrário, e conclui errado sobre o canal.
- Implementar: trocar o glifo da posição por texto. Célula P em duas linhas: "6º" e, embaixo, "empate" (12 px, cor muted). A legenda da ordem vira "Empate: mesmo valor na tela, mesma posição." O ＝ fica só na Direção. A 390, "empate" cabe sob o ordinal no canto do cartão.

### 3. Frase do divisor "Sem medida" afirma o que a linha desmente. Severidade: corrige
- Tela e estado: Crescimento, divisor. Evidência: o divisor diz "Estes canais não têm 30 dias medidos", mas Caderno de Bordo está ali por esconder os inscritos e o canal do dono por não ter coleta própria.
- Custo: o dono acha que o canal oculto só precisa esperar 30 dias.
- Implementar: Crescimento: "Estes canais não têm Crescimento medido; o motivo está em cada linha. Sem número, não entram na numeração e nunca valem zero." Direção: manter "56 dias", só se todos os motivos forem esse; senão a mesma forma ("não têm Direção medida; o motivo está em cada linha").

### 4. Vocabulário duplo de "posição" na faixa. Severidade: corrige (texto)
- Evidência: a faixa abre com "Sem posição por Crescimento." e a frase seguinte diz que a coluna P numera os canais. O dono lê "sem posição" e olha uma tabela numerada.
- Texto exato: ver a resposta 2 abaixo.

### 5. Sugestões (não bloqueiam)
- Cabeçalho P sem explicação: pôr o ⓘ do lote rápido (Hanna, ponto 5) com "Posição pelo valor da coluna ordenada. 1º é o maior. Canais empatados dividem a posição." Evita a pergunta 1 voltar.
- Os dados do mockup não têm empate na Direção, então a regra não pode ser vista. Pôr dois canais com o mesmo percentual inteiro (ex.: +12% e +12%) antes de mostrar ao dono.
- Mobile: nas ordens sem posição do dono, a faixa ocupa texto de 4 linhas mais dois botões de largura total antes do primeiro cartão. Deixar os dois botões lado a lado, ou só o texto curto da resposta 2 (as duas linhas).
- Leitor de tela: a frase "Seu canal: ..." do anúncio de ordenação (`fraseSeuCanal`) não está no mockup; confirmar no produto que continua anunciando.

## Respostas às perguntas abertas do NOTAS.md

**1. Ordem crescente: posição canônica, não recontagem.** P = 1º no maior valor em qualquer sentido (achado 1). Pergunta ao dono, uma linha: "Quando você inverte a ordem, o 1º continua sendo o maior. Está bem?"

**2. O porquê na faixa "Seus canais".** O motivo real, no código e no plano: `POSICIONADAS = ['subs','vpd']` (`posicao-model.ts:12`) e a decisão **D3 do plano da A3**: "posição escrita só em Inscritos e Views/dia", por "emenda 45 (d): posição só para os seis números" (spec, pergunta 8: inscritos, views/dia, por mil, longos acompanhados, mediana de views, longos em 90 d; "nunca para os outros sete"). Ou seja: **é escolha de escopo registrada, não limite do dado.** Nenhum desses seis números é uma variação; Crescimento e Direção, Ritmo, Outliers e Trocas nunca tiveram posição do canal do dono. A Hanna pediu para confirmar, e está confirmado nos documentos. Duas consequências para o texto: não dizer que "não dá para calcular" (falso), e dizer o que o dono vê hoje, que é verdadeiro e útil: o canal dele não tem Crescimento nem Direção medidos (o mockup e a E5a assumem isso até a R9).

Texto final da faixa, ordens Crescimento e Direção (2 linhas):
- Linha 1 (negrito): "Seu canal ainda não tem Crescimento medido." (Direção: "Seu canal ainda não tem Direção medida.") Só aparece quando o canal do dono está de fato "não medido" nessa coluna; se estiver medido, mostrar o valor e o lugar dele na lista pela coluna P, sem frase de falta.
- Linha 2: "A posição do seu canal em relação aos outros só existe em Inscritos e Views/dia, os números de tamanho e de alcance. Aqui, a coluna P numera os canais da lista."
- Botões: "Ordenar por Inscritos" e "Ordenar por Views/dia" (como estão).

Isso responde o dono ("com o motivo explicado") sem inventar causa técnica. Se ele quiser a posição do canal próprio também em Crescimento e Direção, o custo é acrescentar a chave em `POSICIONADAS` (a própria D3 diz isso), mais a R9 para o canal próprio ter valor; levar como pergunta quando a R9 entrar, não agora.

**3. Empate em Direção: sim, a mesma regra.** Mesmo percentual inteiro mostrado = mesma posição, numeração de competição, desempate visual em ordem alfabética (nos dois sentidos), e a posição é calculada sobre o valor mostrado, nunca sobre a razão bruta (senão a ordem das linhas parece errada: +12,3% antes de +11,6%, ambos escritos "+12%"). A faixa de ±10% que decide ▲/＝/▼ não entra no empate: +12% e +9% têm posições diferentes. Em Crescimento a regra do mockup fica como está (grupo "sem variação" na mesma posição, entre quem cresceu e quem perdeu; verificado: 6º, 6º, 6º, depois 9º, e 4º, 4º, 4º, depois 7º em crescente se P for recontado, que o achado 1 elimina).

## Não verifiquei
Leitor de tela real; toque em aparelho; sol na tela e rede lenta; comportamento com dado real de produção (os 14 canais são inventados); se o recorte de 50 linhas e "Mostrar mais" do lote rápido mexe na numeração (a posição canônica de P a resolve, já que não depende da linha visível).

Para a Naksu: a cor do "não medido" do canal próprio (laranja escuro sobre fundo marrom na última linha) pareceu de baixo contraste na captura; medir.
