# Conferência Naksu, peça 8, rodada 1 (não é revisão nova)

Aberto por `file://` (Playwright, Chromium), 1440 e 390, claro e escuro. Nenhum servidor subido (47701 intocada, 47702 não usada; nada a derrubar). Capturas e `medidas.json`/`medidas2.json` em `revisao-naksu-shots/peca8-conf/`. Fontes web offline (medi com a reserva).

## Veredito: ACORDO (pronto para o dono), com 2 resíduos de sugestão que não bloqueiam.

## Achados da rodada 1
| # | Estado | Evidência medida |
|---|---|---|
| C1 gráfico a 390 | RESOLVIDO | viewBox 320x214, escala 1,025: texto 12 px, raio dos pontos 4,1 px (antes 7,7 e 2,3). A 1440: viewBox 900x246, escala 1, texto 12 px, sem sobra. |
| C2 gabarito "N"/plural | RESOLVIDO | `nl`: 4 linhas "Não foi possível contar os vídeos do arquivo." e nenhum "N trocas". `um`: "1 troca", "1 vídeo no arquivo ficou fora", "1 mudança". Valor do meio no `nl` diz "pelo menos 12 ... os do arquivo não foram contados". |
| C3 esqueleto | RESOLVIDO | seções final/esqueleto, 1440: 163/163, 670/669, 193/193; 390: 258/258, 1133/1133, 355/355 (1 px na lista a 1440, aceito). Esqueleto sem número ("N trocas", "No arquivo (N)" ausentes); seção das contas em esqueleto. |
| C4 Mostrar mais | RESOLVIDO | após clique o foco vai ao primeiro link novo ("Pernambuco de ônibus...", "Um mês na Patagônia..."); `role=status aria-live=polite` nos dois contadores ("Mostrando 50 de 150"); no último lote o foco fica no último link ("Lisboa fora da rota turística (parte 11)"), não cai em `body`. O botão da lista principal agora também funciona (25 -> 32 de 162). |
| C5 frase digitada | RESOLVIDO | "mandar videos antigos..." libera (`aria-disabled=false`, "Frase confirmada."); maiúsculas libera; "mandar" mantém desabilitado. O ⓘ já não promete o que o código recusa; a mensagem de estado diz "Maiúscula e acento não importam". |
| C6 tabela a 390 | RESOLVIDO | tabela 480 px em caixa de 270 px com rolagem; coluna Canal 150 px ("Viagem Lenta" 1 linha de nome, 52 px a célula com a nota); rolagem da página 0. |
| S1 | PARCIAL | Resumo e linha "Agora" não repetem mais a frase. Resíduo R1 abaixo. |
| S3 | FEITO | rótulo "02/05" no último ponto, "05/12/2027" sob o marco, "8,0 mil" na tabela, `aria-describedby="p8-leit"` presente. |
| S4 | PARCIAL | "Canais" 44 x 44 a 390 (42 x 44 antes). Link "arquivo.html" do texto de introdução segue com 17 px de altura (link em parágrafo, aceito; era opcional). |

## Elementos novos (contraste e alvo)
| Item | Escuro | Claro | Alvo 1440 / 390 |
|---|---|---|---|
| Linha do comando (`code`/`--sunk`) | 16,2:1 | 14,2:1 | n/a (selecionável, `user-select:all`) |
| Título do bloco (h4) | 15,6:1 | 15,1:1 | n/a |
| Passos (`.p8-pas`, 13 px) | 6,67:1 | 6,83:1 | n/a |
| Botão Copiar (texto) | 14,5:1 | 15,8:1 | 32 x 62 / 44 x 246 (largura total) |
| Borda do Copiar, Já rodei, Desfazer, Ver o comando | 1,44 a 1,55:1 | 1,69 a 1,77:1 | token herdado (S5 da rodada 1), não novo |
| "Já rodei" | 14,5:1 | 15,8:1 | 36 x 82 / 44 x 82 |
| "Desfazer" | 14,5:1 | 15,8:1 | 32 x 76 / 44 x 76 |
| Texto do "Marcado como rodado" | 15,6:1 | 15,1:1 | n/a |
| Foco por teclado em Copiar | outline 2 px #FF8240 | 2 px #B8481A | visível |
| Estado âmbar `?vs=semat`, borda 2 px `--warning` | 8,31:1 | 4,50:1 | ⓘ 28 / 44 |
| Âmbar, texto 14 px e 13 px | 12,7 / 5,4:1 | 13,3 / 6,0:1 | n/a |

Comportamento: "Já rodei" move o foco ao bloco `role=status tabindex=-1`; "Desfazer" devolve o foco a "Já rodei". Âmbar com ícone "atenção" (triângulo) além da cor. Fonte mínima 12 px; rolagem horizontal 0 nos dois tamanhos. A 1440 os botões de 32 px seguem o padrão do produto (sem achado).

## Resíduos (sugestão, não bloqueiam)
- R1. Quadro SIM45, clique em "Ver o que passaria": `li.textContent.indexOf('140')` não acha o 140 (a tabela fixa está em outra `li`), então entra uma segunda tabela "9 vídeos de 3 canais" acima da de 45 canais, sob o resumo "312 de 45". Correção: dar `data-n="45"` ao `li` e ler `+li.dataset.n` em vez do `indexOf`, ou deixar o botão alternar a tabela fixa já aberta. Só afeta a mostra.
- R2. Link "arquivo.html" (17 px de altura) em linha própria, se quiser fechar S4 por inteiro.

## Não verifiquei
Leitor de tela, Opera real, aparelho de toque, rede lenta, fontes web, teclado virtual aberto; Copiar usa o fallback "Selecione e copie" sob `file://` (a Clipboard API não roda aí).
