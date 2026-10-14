# Conferência Naksu, peça 7, rodada 1 (corrigida)

Método: file:// (nenhum servidor subido; 47701 intocada, 47702 não usada), Playwright, 8 estados x 1440/390 x claro/escuro (32 capturas), mais cliques em Copiar, "Já rodei", "Desfazer", "Esconder os comandos". Capturas e script em `revisao-naksu-shots/peca7-conf/`.

## Veredito: ACORDO. Pronta para o dono pela parte da Naksu.

| Achado | Situação | Evidência |
|---|---|---|
| C1 Copiar | Resolvido | `<pre><code>` 12,5 px em `--sunk` (14,21 claro / 16,20 escuro) + botão "Copiar" com aria-label; clique grava no clipboard (lido de volta: `npm run obs:arquivo \| ssh forja 'bash -s'`), rótulo "Copiado", `role=status` fala "Comando copiado"; fallback seleciona e diz "Selecione e copie". A 390 px: botão 272x44, bloco quebra sem rolagem |
| C2 Hierarquia | Resolvido | grupo h3 15 px/600; item h4 14,5 px/600; passo/título do comando 13,5 px |
| C3 "Já rodei" | Resolvido | `aria-labelledby` aponta para h4 existente (`t-a` presente); `role=status` anuncia; foco no `.p7-marc`; "Desfazer" 44 px a 390 (32 px a 1440, padrão `.btn.small`), devolve os 3 itens e o foco em "Ver os comandos". "Já rodei" agora está no passo 3, longe de "Ver os comandos" |
| C4 Comentários | Resolvido | "substituída em 26/03, passou a esperar em 25/04", barra de 8 dias (26/03+30 = 25/04) |
| S1 | Resolvido | rótulo vira "Esconder os comandos" (181x36 / 326x44) |
| S2 | Resolvido | faixa única acima da lista; itens com "Apagar indisponível: veja o aviso acima." de uma linha |
| S3 | Resolvido | "60+ dias" quando dias>60 (visto no item de 63 dias) |
| S4 | Aceito | forma + número mantidos |

Contraste dos elementos novos (texto do botão sobre o fundo do botão): 15,76 claro / 14,48 escuro (Copiar, Já rodei, Desfazer, Ver/Esconder). Alvos 390 px: todos 44 px. 1440 px: 32/36 px, padrão do produto. Zero rolagem horizontal nas 32 capturas. Mínimo de fonte 12 px. Nenhum `color-mix`.

Ressalvas (não bloqueiam): "Desfazer" fica até o próximo recarregamento, não 10 s (mais permissivo que o pedido, aceito). Não verificado: leitor de tela real, Opera real, aparelho real, clipboard fora do Chromium.
