# Conferência do Logan: mockup 19, peças 1 a 3 (revisão 19-1)

14/10/2026. Só os achados de REVISAO-LOGAN-19-1.md, lidos no código (sem navegador). Pasta: 19-mes-fora-do-banco/.

## Veredito: ACORDO nas três páginas (index, series, arquivo). Nenhum pendente que bloqueie, nenhum defeito novo criado pelas correções.

| Achado | Estado | Evidência |
|---|---|---|
| D-1 texto do ⓘ de "Fechado" | resolvido | arquivo.js L10: texto do Logan (28 dias, 45 nos comentários, respostas até 37 dias, copiado de novo) |
| D-2 "comandos"/arquivo; "Ver os comandos" abre a lista | resolvido | arquivo.js L148 (CMDHTML: Mac grava arquivo, forja roda `bash expurgar-….sh`), L277 abre na própria linha; divergência L225/L241 na tabela do índice (index.js L22) e remessa ao fecho do spec 04 (NOTAS) |
| D-3 "Recup." em vez de "Teste" | resolvido | arq-dados.js L4 `['Recuperação','Recup.']` |
| D-4 / S1 rótulo "Hoje (trecho reconstruído do N aprovado)" com link | resolvido | series.js L36-47 (21 diz "segurado"); links ../../2026-10-13-a5-lote-2/… existem |
| S2 números crescentes em P1-2 | resolvido | series.js L19 (2,9; 4,1; 6,0; 18,6; 25,3 mil) e L54, entre 9,8 mil e 31,5 mil |
| S3 P1-12 sem "Ver antigo" à esquerda | resolvido | series.js L98-101 (esquerda `grafico(..., true)` sem a porta; nota diz que a porta é da peça 6) |
| Sugestão: média de P1-1 | resolvido | series.js L65 "A média muda porque passa a contar só o que está online." |
| D-5 sem "+ novo" | resolvido | arquivo.js L71 e L142: "Peça 4/8, desenhada à parte", `m-slot` |
| A1 ação na linha que precisa do dono | resolvido | arq-dados.js L19 (m5a com `cmd1`), arquivo.js L25 "Ver o comando"; frase-resumo linka `#mes-m5a` (L104-105) |
| A2 data do caso magro | resolvido | arquivo.js L91: cartão dos comentários diz 15/12/2026 nas duas frases |
| A3 "Sem NAS · Sem B2" | resolvido | arq-dados.js L6 |
| A4 perfil "edita" | resolvido | arquivo.js L110-111 ("esperam quem administra o site", frase única abaixo); L64 resumo de canais; "Quem administra o site faz isto." não existe mais; capturas `shots/arquivo-perfil-ed-*` existem. (Não conferi a tela renderizada, só código e a existência das capturas.) |
| A5 "só lê" sem a aba Arquivo | resolvido | arquivo.js L266 passa `semArq`; m19.js L69 filtra a aba; L235 "Esta página é de quem edita o site." + "Voltar para Canais" (alvo 44 px) |
| A6 "hoje" | resolvido | arquivo.js L104-110: "Um mês já pode sair."; datas só no caso futuro (calmo: 01/05/2027) |
| A7 "Ver o que sairia" na linha "Pode sair" | resolvido | arquivo.js L24, os dois botões na ordem de T3 |
| A8 segundo canal | resolvido | arq-dados.js L81 c7 "Rota Andina" |
| Sugestão: aviso `role="status"` ao trazer de volta | não verificado/parcial | não achei `role="status"`/`aria-live` no fluxo; era sugestão, não condição. Levar à implementação (M10). |

## Não verificado
Navegador (Esc, foco, tabulação), leitor de tela, Opera, aparelho real. As medições da Naksu em shots/medidas.json não foram relidas por mim.
