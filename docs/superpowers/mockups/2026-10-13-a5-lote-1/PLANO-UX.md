# Plano de UX do lote 1 da A5 (13/10/2026)

> **Rodada 2 (13/10):** este plano é o da rodada 1. Onde ele diverge do `LEIAME.md` (A: dia 7 = 6 dias depois da publicação; B: "últimos X dias" = o que foi assistido, não vídeos publicados; C: e-mail no 3º dia e lembrete por semana, sem "alarme encerrado"; E: comentários na fila), vale o `LEIAME.md`.

Feito antes do código, com a skill `frontend-design`, e revisto contra o pedido na seção "Revisão do plano". Os cinco desenhos ficam dentro da identidade já aprovada do Observatório (tokens de `a4.css`, cópia da pasta `2026-10-12-a4-proprio-e-ajustes/`). Nenhum matiz novo; só formas novas.

## Para quem é e o que cada tela responde em 3 segundos

O dono, sozinho, no CMS, de manhã ou entre gravações. Lê de relance, desconfia de número que parece bom demais e já reprovou bloco monocromático, bloco em prosa, cor sem símbolo e jargão.

| Mockup | A pergunta dele | A resposta de relance |
|---|---|---|
| A. Ainda cedo | "Esse vídeo novo está sem impressão porque ninguém viu ou porque o dado ainda não chegou?" | "Ainda cedo: dia 4 de 7. Os dias que o YouTube já mandou vieram com 0; hoje e ontem ainda não chegaram." |
| B. % assistido por período | "Esse vídeo prende mais do que o canal prende agora, ou só mais do que ele prendia antes?" | "Acima do normal dos últimos 90 dias: 54% contra 51%." e, logo abaixo, "o canal vem melhorando: +4 pontos" |
| C. Canal em erro | "Algum canal parou de sincronizar, desde quando, por quê, e preciso fazer algo?" | "1 canal em erro há 9 dias: o YouTube diz que ele não existe. Você precisa decidir." |
| D. Atraso da leitura por hora | "A medida por hora está rodando? Perdi horas que não voltam?" | "Parada há 3 horas. 3 horas sem medida; hora perdida não volta." |
| E. Saíram do YouTube | "O que sumiu, o que eu tenho guardado disso, e o que acontece se eu apagar?" | "5 itens esperando você. Nada foi apagado. Sem resposta, o dado fica." |

## Ideia de cada tela (uma forma memorável por tela, o resto quieto)

- **A. A faixa dos 7 dias.** Uma fileira de 7 casas, uma por dia de vida do vídeo, no lugar do gráfico quando o gráfico só teria zeros. Cada casa tem forma própria: caixa vazada com 0 (zero medido), barra com número (com impressão), hachura rosa (não medido: hoje e ontem), contorno pontilhado (o dia ainda não existe). A faixa é também a barra de progresso até o 7º dia, e serve ao "vídeo novo" (menos de 3 dias) com as mesmas formas. O gráfico por dia volta no primeiro dia com número ou no 7º dia, o que vier primeiro.
- **B. O normal de agora.** Um seletor de três posições (canal inteiro, últimos 90 dias, últimos 28 dias) manda na frase e na marca da barra. Abaixo da barra, uma segunda linha responde ao "melhora ou piora": o normal do período escolhido contra o normal de sempre, com ▲ ▼ ＝. Na aba Retenção do canal, a tabela do normal por faixa de duração ganha as três colunas lado a lado, onde "poucos vídeos para comparar (3 de 5)" aparece como o estado de verdade que é.
- **C. A escada de 3 dias.** O canal em erro tem três idades e cada uma tem forma: triângulo cheio com fundo (erro novo, avisando), triângulo cheio com fundo e contador "dia 2 de 3" (alarme ligado), triângulo só em contorno com "aviso encerrado" (depois do 3º dia: o alarme calou, a marca fica). A mesma cor (família do erro) nas três; a forma e o texto mudam.
- **D. A trilha das horas.** Uma fileira de 24 casas (as últimas 24 horas), cada uma medida (cheia), medida fora do horário (cheia com contorno duplo) ou sem medida (hachura rosa). O aviso no cabeçalho é a frase; a trilha é a prova. Desligada e sem leitura têm cada uma o seu estado, e nenhuma delas é verde.
- **E. O que some e o que fica.** A confirmação de apagar é um painel de duas colunas dentro do próprio cartão do item: "O que some" (com contagens) e "O que fica" (com o que sobra e o que a gente não alcança). O botão só acende depois de digitar `APAGAR`. O padrão do botão é Manter.

## Hierarquia em todos

1. Frase-resumo (uma frase, número em destaque, símbolo).
2. A forma de relance (faixa, barra, trilha, escada, duas colunas).
3. O detalhe sob demanda: ⓘ com o método, `<details>` para a tabela.
4. Nunca: parágrafo de método no corpo.

## Estados por tela (e como chegar)

Todos têm `?caso=` (e `?tema=claro`); a lista exata está no `LEIAME.md`. Cada tela mostra o caso cheio, o magro, o sem dado e os estados de borda do pedido (A: 17 h, 2 d, 4 d só zeros, 4 d com número, 7 d; B: poucos vídeos, período sem comparação, piora; C: 1, 3, nenhum, 2 h, 2 d, 9 d, cada recusa; D: em dia, 3 h, 14 h, várias tarefas, desligada, sem leitura; E: vazia, cheia, confirmar vídeo, confirmar canal, apagando, voltou ao ar, recusa da forja).

## Regras que valem para os cinco (do dono)

Frase-resumo; forma além da cor (lê em escala de cinza); cor estável por significado (verde só para subindo; âmbar/ocre para descendo e parado; rosa hachurado para não medido; família do erro para erro; nada de verde para "lida"); método no ⓘ; "zero medido" (caixa vazada com 0) nunca se confunde com "não medido" (hachura); texto de 12 px ou mais; alvos de toque de 44 px a 390 e 640; sem rolagem horizontal; claro e escuro; nunca `color-mix()`; português simples (sem "lido", "gravou", "CTR", "diário").

## O que foi descartado e por quê

- **A. Gráfico com as colunas de zero em cinza claro.** Continua sendo um gráfico de zeros; o olho lê "nada aconteceu". A faixa mostra o mesmo fato (0 medido) sem a pretensão de tendência.
- **A. Esconder os zeros e escrever só "ainda cedo".** Perde a prova de que o YouTube mandou o dia. Descartado: o 0 fica dentro da casa.
- **A. Cortar o gráfico por regra única de "menos de 7 dias".** Esconderia o gráfico bom (4 dias com 40 e 69 impressões). A regra é "só zeros E menos de 7 dias".
- **B. Três réguas, uma por período, sempre à vista.** Ruído de relance. Ficou: um seletor, uma frase, uma linha de tendência; as três juntas só na aba Retenção, onde se compara.
- **B. Cair em silêncio para o canal inteiro quando o período não tem 5 vídeos.** Daria a leitura de outra coisa com o rótulo errado. A frase diz "poucos vídeos para comparar" e oferece o botão para ver contra o canal inteiro.
- **B. Salvar a escolha no banco por usuário.** Pesado para uma escolha de leitura. Ficou o navegador, com a pergunta ao dono.
- **C. Pastilha vermelha igual para todo erro.** Perde a idade, que é o que decide a ação. A forma carrega a idade.
- **C. Mensagem de erro técnica ("YouTube API 404").** Trocada por motivo em português e por quem resolve (o canal, o YouTube ou nós).
- **D. Semáforo verde, amarelo e vermelho.** Verde e âmbar são só de direção. Ficou: sem destaque quando está em dia, erro quando passa da tolerância.
- **D. Gráfico de 30 dias.** A trilha de 24 horas responde à pergunta do dia; a cobertura do mês fica numa frase.
- **E. Janela de confirmação modal no meio da tela.** Esconde o item que está sendo apagado. Ficou o painel dentro do cartão, de modo que o dono vê o vídeo e a contagem juntos.
- **E. Botão "Apagar" com a mesma força do "Manter".** O padrão é guardar; apagar é irreversível e fica em contorno de erro, atrás da digitação.

## Revisão do plano (contra o pedido)

Verifiquei o plano contra o pedido antes de desenhar, ponto a ponto, e mudei quatro coisas:

1. **A:** o pedido diz "sem gráfico de zeros"; a primeira ideia (gráfico com barras apagadas) foi trocada pela faixa de casas (ver "descartado").
2. **B:** o primeiro plano tinha o seletor só na tela do vídeo; o pedido diz "também na aba Retenção do canal", então a aba ganhou as três colunas.
3. **C:** a primeira ideia mostrava só a pastilha; o pedido quer o resultado do botão "Sincronizar agora" (recusado ou falho), então o desenho ganhou o painel de resultado sob a linha do canal, com cinco desfechos.
4. **E:** o primeiro plano tratava canal inteiro como lista de vídeos; o spec manda um item só. O canal inteiro virou um cartão único, com a contagem de vídeos dentro.

O que o revisor de UX sênior deve cobrar mais de perto está no fim do `LEIAME.md`, em "Onde o desenho é mais fraco".
