# Revisão de UX, rodada 2: mockup 22 "Perguntar a uma IA" (13/10/2026)

Revisor: `revisor-ux-senior`. Não editei nada do mockup. Servi a pasta por HTTP na porta 47783 (a 47745 já estava em uso por outra sessão; não toquei nela), Playwright/Chromium headless próprio, sem a porta 3099 e sem o e2e do projeto; servidor derrubado ao fim. Medi 15 estados a 1440x900 (escuro) e a 390x844 (claro, toque), 11 telas x com e sem o direito, contraste em 18 combinações de estado e tema, foco e Tab. Olhei as capturas de extremo (Mudanças), extremo2 (Canais, 390), leitura, carregando (1440 e 390), nm (390), comentários, falhou, privado, vazio, zero (390), copiado (recorte) e mapa (390). Scripts e saídas em `/private/tmp/claude-501/.../scratchpad/ux22r2/` (fora do repositório).

## Veredito: PODE ir ao dono. Zero bloqueios. Três melhorias que não impedem.

### Pergunta de quem abre
"O que vai sair do site, cabe numa mensagem, e o que ficou de fora?" Continua respondida no primeiro olhar a 1440 escuro: frase-resumo, barra com a marca de 30.000, quatro linhas com símbolo, cor e palavra.

## Conferência dos bloqueios e "corrige" da r1

| Item r1 | Resolvido? | Evidência da r2 |
|---|---|---|
| B1 prosa e "série" na linha "Por tamanho" | Sim | `extremo-1440-escuro.png` e `extremo2-390-claro.png`: duas linhas curtas, rótulo à esquerda e número em mono à direita ("dia a dia de 8 canais 7.300", "linhas além da 25ª da tabela de trocas 4.500"). 7.300 + 4.500 = 11.800 = 41.800 - 30.000. Canais: 190.000 + 42.400 = 232.400 = 262.400 - 30.000. `grep` por série, diário, snapshot, payload, pipeline, CTR, retenção, lido, gravou em `pi.js` e `pi-dados.js`: zero ocorrência na tela ("sincronização" é palavra comum). |
| B2 "0 caracteres no meio" em só leitura | Sim, pela causa | Medi texto visível + dobras = total nos 15 estados e nas 22 combinações tela x direito: **todas fecham** (ex.: leitura 1.550 + 4.120 = 5.670; canal próprio sem direito 1.501 + 5.489 = 6.990; vídeo sem direito 1.465 + 2.715 = 4.180). Nenhuma dobra em zero. A dobra de leitura agora diz "4 tabelas" e o total 5.670 sustenta o que o cabeçalho afirma. |
| C1 "Copiar texto" ligado ao carregar | Sim | `carregando-1440-escuro.png` e `-390-claro.png`: os dois botões tracejados e apagados, só uma frase "Montando o pacote da tela Comparar…" no topo. |
| C2 nota repete a frase-resumo | Sim | `nm-390-claro.png`: sem caixa de nota; a frase "só 2 de 16 números medidos" com hachura e a faixa AVISO da prévia bastam. Vazio idem (`vazio-1440-escuro.png`). |
| C3 detalhes em prosa | Sim | `leitura-1440-escuro.png`, `privado-1440-escuro.png`, `comentarios-1440-escuro.png`: uma linha curta por detalhe ("de fora: impressões por dia e cliques estimados", "14 comentários de fora", "12 comentários, sem nome"). |
| S1 dois cadeados | Feito | "nunca entram" virou escudo; em escala de cinza o cadeado (sem o direito) e o escudo se distinguem. |
| S7, S8 | Feitos | "aguarda o 2º registro do dia"; "0 zeros medidos" / "1 zero medido" / "1 não medido". |
| S2, S3 mantidos e declarados; S5, S6 recusados com motivo | Aceito | Ver melhorias M1 e M3 abaixo. |

Nenhum defeito novo foi criado pelos ajustes: as linhas novas não estouram a coluna a 390 (rolagem horizontal 0), a lista de cortes não empurra o aviso fixo nem os botões para fora, e o resumo "Vídeo próprio: 4 tabelas, 5.670 caracteres, [pastilha]" lê bem.

## Veredito por estado e largura

Par obrigatório: 1440 escuro e 390 claro. Todos com rolagem horizontal 0, nenhum texto abaixo de 12 px, nenhum alvo abaixo de 44 px a 390 (13 estados medidos com ponteiro grosso, lista vazia em todos).

| Estado | 1440 escuro | 390 claro |
|---|---|---|
| Típico (Comparar, 12.400) | pronto | pronto |
| Copiado | pronto (ver M1) | pronto |
| Falhou ao copiar (Baixar vira principal) | pronto (ver M1) | pronto |
| Cortado por tamanho (Mudanças, 41.800) | pronto | pronto |
| Passa do arquivo completo (Canais, 262.400) | pronto (ver M2) | pronto |
| Zero medido (Outliers) | pronto | pronto |
| Não medido / magro (Canal) | pronto | pronto |
| Vazio | pronto | pronto |
| Com dado privado | pronto | pronto |
| Só leitura, sem o direito | pronto | pronto |
| Comentários de terceiros (bloco com `│ `, já rolado) | pronto | pronto |
| Erro ao montar | pronto | pronto |
| Carregando | pronto | pronto |
| Tela fechada (botão) | pronto | pronto |
| Mapa das 11 posições | pronto (esquemático, ver M3) | pronto |

## Bloqueios

Nenhum.

## Melhorias (não bloqueiam)

**M1. A 1440x900, nos estados com faixa extra, o rodapé do miolo corta a última linha no meio.** Medido: `.pi-corpo` com scrollHeight - clientHeight de 16 px (típico, extremo, comentários) a 66 px (copiado e falhou). Em `copiado-1440-escuro.png` o contador "34 de 1.000 caracteres" aparece cortado ao meio e a linha "Exemplos:" some atrás do aviso; em `extremo-1440-escuro.png` a borda de baixo dos chips de exemplo está cortada. Não esconde nada decisivo (frase, tamanho, números, o que ficou de fora, aviso, faixa de resultado e botões estão inteiros), e a r1 S5 foi recusada com motivo que ainda vale. Conserto de uma linha: diminuir a altura da prévia (`.pi-cod-b`) em cerca de 70 px quando há faixa de resultado, e em 20 px nos demais, para o miolo caber sem rolar a 900 px de altura. A 390 px a rolagem do miolo é o desenho (folha), não defeito.

**M2. Canais (262.400): dois desdobramentos do mesmo 232.400 convivem na tela.** A legenda da barra diz 170.000 "só no arquivo completo" e 62.400 "não saem"; a lista de "Por tamanho" diz 190.000 e 42.400. As duas somam 232.400 e a conta fecha, mas o olho vê quatro números e pode tentar casá-los dois a dois. Conserto: acrescentar na lista, depois dos dois itens, um total em mono ("soma 232.400"), ou rotular a lista como "o que saiu da cópia" e a legenda como "para onde foi". Só afeta o caso extremo.

**M3. Já declarados pelo desenhista e mantidos como pergunta ao dono:** o mapa das 11 posições é esquemático (só Comparar tem a tela de trás desenhada; a faixa real de Vídeo e Vídeo próprio a 390 px não foi desenhada), a pastilha laranja "inclui dado privado" convive com a linha verde "incluído" (laranja = é do seu canal, verde = entrou) e `--lado-n` serve de "medido" nesta tela. Concordo em levar as três como perguntas na aprovação.

## Medidas

Contraste (cor composta sobre o fundo composto, lido da página), texto, menor razão por estado:

| Elemento | Escuro | Claro | Mínimo | Resultado |
|---|---|---|---|---|
| "Markdown · início e fim" e "exemplo" na prévia (12 a 12,5 px) | 5,90 | 6,43 | 4,5 | passa |
| "Copiar texto" / "Baixar .md" principal (13 px, texto sobre `--accent`) | n/a (maior) | 5,01 | 4,5 | passa; é o menor de todos |
| "não medido" na prévia (rosa) | n/a | 5,85 a 6,37 | 4,5 | passa |
| "(opcional)", "exemplo" no erro e no carregando | 6,18 | 7,13 | 4,5 | passa |

Elemento gráfico contra o fundo do diálogo:

| Elemento | Escuro | Claro | Mínimo | Resultado |
|---|---|---|---|---|
| Barra de tamanho, verde (cabe) | 7,26 | 6,37 | 3 | passa |
| Barra de tamanho, âmbar (cortou) | 7,71 | 4,70 | 3 | passa |
| Bloco "medido" (areia) | 11,88 | 8,32 | 3 | passa |
| Borda "zero medido" `--im-zero` | 4,97 | 4,84 | 3 | passa |
| Borda "esta tela não tem" e "nunca entram" (cinza) | 4,86 | 5,59 | 3 | passa |
| Borda "sem o direito" (âmbar) | 7,71 | 4,70 | 3 | passa |
| Borda do diálogo | 7,81 | 6,12 | 3 | passa |

Alvos de toque a 390 px: nenhum controle do diálogo abaixo de 44 x 44 em 13 estados. Largura medida: rolagem horizontal da página 0 em todos os 30 casos. Alturas do miolo a 1440x900: ver M1. Foco: anel sólido de 2 px `--accent` em todos os 16 Tab testados; o foco inicial vai ao título (decisão declarada, concordo); Tab não sai do diálogo; Esc fecha e devolve o foco a `#pi-abre`. `grep color-mix`: só o comentário "sem color-mix" em `pi.css`.

Conferência do que o dono cobra: frase-resumo em um `<span>` em todos os estados, barra de tamanho com o corte desenhado, régua medido / zero medido / não medido, cor estável por significado com símbolo (✓, tesoura, cadeado, círculo pontilhado, escudo, hachura, caixa vazada), método nos três ⓘ, zero medido distinto de não medido também dentro do código da prévia, sem parágrafo de prosa na tela (a única frase corrida é o aviso fixo, declarado), sem jargão, sem `color-mix()`, tema escuro a 1440 e claro a 390, consistência com o lote 1 (mesmos tokens, `<dialog>` modal, "+ novo" tracejado). Spec 8.1.5 (botão em toda tela, 30.000, "Baixar completo" até 200.000, comentários anônimos em bloco de terceiros, aviso fixo) e 8.1.4 (direito "ver desempenho privado" muda o pacote e o diálogo diz o que ficou de fora): atendidos.

## O que não consegui verificar

Leitor de tela (só a árvore de atributos: `dialog` com `aria-labelledby` e `aria-describedby`, `role="img"` com `aria-label` nas barras, `role="status"` e `role="alert"`), Safari, Firefox e o Opera do dono, teclado virtual de celular abrindo sobre a folha, `navigator.clipboard` real (copiado e falhou são simulados), clique de Baixar (arquivo de exemplo), movimento reduzido de forma conclusiva (o esqueleto de carregamento não tem animação, então não há o que reduzir), e o texto real das 11 telas (o do mockup é de exemplo e abreviado).
