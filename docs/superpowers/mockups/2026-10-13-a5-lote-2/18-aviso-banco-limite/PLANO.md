# Plano do mockup 18: aviso "banco chegando ao limite" (A5, lote 2)

Feito antes do desenho, com a skill frontend-design. A linguagem visual é a do lote 1 aprovado (mesma casca, mesmos tokens, mesma faixa de frescor da tela D); aqui a ousadia fica em UMA coisa só: a barra de ocupação com as duas linhas de corte desenhadas.

## Para quem e a pergunta de 3 segundos

Quem edita o site, olhando o cabeçalho do Observatório. Pergunta: **"o banco vai me deixar na mão, e quando?"**. Resposta de relance: uma pastilha na faixa de frescor, ao lado de onde a tela D põe o aviso de leitura por hora, com minibarra e o número ("Banco: 216 de 500 MB"). Quieta quando está bem (borda comum), com borda de cor só em amarelo e vermelho. Ao abrir, o painel responde as outras três perguntas: quanto falta, em que ritmo cresce, quem ocupa.

## Forma memorável

A **barra de 0 a 500 MB com as linhas de 350 e 425 desenhadas** e as três zonas sombreadas à frente do preenchimento (neutra, âmbar, vermelha). O dono vê a distância até cada corte sem ler número. Abaixo dela, uma **régua do tempo** (hoje, 90 dias, 1 ano) com o losango da data prevista: quando cai nos primeiros 90 dias, ele entra na zona vermelha.

## Direção visual (plano e revisão)

- Cor: nenhuma nova. Verde `--success`, âmbar `--warning`, vermelho `--danger` (família do erro), rosa hachurado `--nm` para "não medido", caixa vazada `--im-zero` para zero medido, laranja `--lado-o` = seu canal e azul `--lado-b` = concorrentes na quebra por tipo (mesmos significados do lote 1).
- Símbolo junto da cor, forma diferente por estado (lê em cinza): verde = círculo com visto; amarelo = triângulo com "!"; vermelho = octógono com "!"; não medido = hachura.
- Tipo: Inter para frases, JetBrains Mono para número, Fraunces só no título que já existe. Sem rótulo em caixa alta, sem numeração, sem eyebrow.
- Revisão contra o padrão genérico: o painel de status "cartão com número grande e degradê" foi descartado; o número grande foi trocado pela barra com cortes e por uma frase em linguagem comum. Sem decoração além do que carrega significado.

## Hierarquia do painel (de cima para baixo)

1. Pastilha de estado (palavra + símbolo) + marca "exemplo" + frase-resumo com ⓘ da conta.
2. Barra de ocupação com cortes + legenda dos três símbolos.
3. Quatro números: hoje, livre, cresceu em 28 dias, chega a 500 MB.
4. Régua da previsão (ou, sem previsão, o motivo e os 14 dias de registro).
5. À direita (abaixo, no celular): quem ocupa (concorrentes, seu canal, resto do site, fecha no total) e os lotes exportados esperando confirmação.

## Estados desenhados

verde (216), amarelo (360), vermelho por tamanho (440), vermelho por previsão (392, 80 dias), acima do limite (521), zero medido (não cresceu), previsão não medida (6 dias de 14), sem leitura hoje, lotes a confirmar, erro ao ler, ainda sem medida, só leitura (não vê). Mais painel fechado (só a pastilha). 1440 escuro e 390 claro.

## Decisões de cor e símbolo que o dono pode contestar

Ver NOTAS.md, seção "Dúvidas".

## Rodada do retorno do dono (13/10, depois da reprovação)

Feito com a skill frontend-design antes de editar. Fonte: `RETORNO-DO-DONO-13-10.md`. A linguagem visual (tokens, casca, pastilha, símbolos por estado) não muda; muda o que a tela mede e como o diz.

### O que o dono disse e o que isso muda na leitura

Os 500 MB são do banco INTEIRO do site. Então (1) a pergunta de 3 segundos passa a ser **"quanto do limite do banco do site já foi usado, e quando enche?"**; (2) a unidade da tela é **percentual do limite**, nunca MB (MB só no botão de informação); (3) o Observatório aparece como **uma parte** do banco, não como o dono do limite; (4) "lote" some da frase de tela ("exportação"); (5) um **lugar reservado**, discreto, para o futuro envio ao backup no NAS.

### Plano curto (tokens e layout)

- **Cor:** nenhuma nova. Verde `--success`, âmbar `--warning`, vermelho `--danger`, rosa hachurado `--nm` (não medido), caixa vazada `--im-zero` (zero medido), azul `--lado-b` (concorrentes), laranja `--lado-o` (seu canal), areia `--lado-n` (resto do site), contorno pontilhado `--dim` (ainda não existe).
- **Tipo:** Inter nas frases, JetBrains Mono no número, como já estava.
- **Cortes:** 70% (enchendo, triângulo) e 85% (quase cheio, octógono); a previsão continua em dias e data ("enche em 80 dias"), que é a única medida em que o tempo ajuda e não depende de MB.
- **Fonte única dos números:** os dados de exemplo guardam só os MB de cada parte (concorrentes, seu canal, resto do site) e o quanto cada uma cresceu em 28 dias; tamanho, percentual, "livre", crescimento em %, partes que somam 100, dias e data prevista saem por código dessa fonte. O percentual mostrado é UM inteiro (arredondado uma vez) e o estado (cor, nome, pastilha) é decidido sobre ESSE inteiro, para o texto nunca contradizer a cor.
- **Leitura de relance (forma memorável, a mesma):** a barra de 0% a 100% do limite com as linhas de 70% e 85% e as zonas; o valor (43%) fica em cima do preenchimento, o eixo diz 0, 70, 85, 100. Sai o número grande em MB; entra a distância até o corte em percentual.
- **Acima do limite lê-se assim:** a barra enche inteira e o rótulo diz "104%" com "4% acima"; a frase "Banco do site acima do limite: 104% do limite. Passou 4% do limite."; a célula vira "Acima do limite 4% do limite". Nunca um número menor que 100 num estado acima.
- **Previsão sem MB:** a régua do tempo não usava MB (dias e data), então só muda o título ("Quando chega ao limite"). A conta com os MB vai para o botão de informação.
- **"Quem ocupa" em parte percentual:** barra empilhada em dois níveis, com um colchete "Observatório" por cima de concorrentes + seu canal e o "Resto do site" ao lado; tabela com Observatório (e os dois que o compõem, recuados), Resto do site e o total "Banco do site 100%", em duas colunas: parte do banco e parte do crescimento em 28 dias. Cada coluna soma 100 (maior resto). Sem crescimento (zero medido): a coluna de crescimento não existe (não há o que dividir) e a frase diz "o banco não cresceu em 28 dias". Sem medida de crescimento: a coluna some e o número diz "não medido".
- **Lugar do NAS:** uma linha pontilhada no pé do painel ("Backup no NAS ao chegar a um percentual do limite" + etiqueta "ainda não existe"), sem botão e sem campo, sem cor. Só aparece com o painel aberto; ocupa uma linha. Fica ou sai: pergunta para o dono.

### Revisão do plano contra o padrão genérico

Descartado: o cartão com o "43%" gigante e degradê (é o padrão de painel de status); o percentual fica na barra e na pastilha. Descartado: três barrinhas de porcentagem separadas; a barra empilhada com colchete mostra de relance que o Observatório é só uma parte. Mantido: a única ousadia continua sendo a barra com os cortes.

### Estados cobertos nesta rodada

verde, amarelo, vermelho por tamanho, vermelho por previsão, acima do limite, zero medido, previsão não medida, sem leitura hoje, erro, vazio, exportações a confirmar, só leitura; painel aberto e fechado; 1440 escuro e 390 claro (e os quatro cruzamentos).
