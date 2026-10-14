# Diálogo "Remover canal" com a linha do arquivo (M4, prioridade 1)

Arquivos: `index.html`, `rc.css`, `rc.js` (autocontido: tokens copiados de `chrome.css`, mesmo valor, nenhuma cor nova, nenhum `color-mix`). Capturas em `shots/` (1440 e 390, claro e escuro; `*-alto-*` mostram a caixa inteira, sem rolagem interna). Abrir: `index.html?e=d3`. A barra "Estados do mockup" (fechada por padrão; `?barra=aberta`) alterna D0 a D9, D5+D8, os retornos R1 a R3, as três combinações Comando|Bloco, casa fora, quem abre, meses e data do D7, nome curto ou de 100 caracteres, tema.

## O que mudou em relação ao diálogo aprovado (canais.html) e por quê
- **Quinta linha "meses no arquivo"** na lista de perdas, com a caixa de arquivo (ícone novo). D1/D2: caixa de zero medido `0`; D5: hachura rosa; nunca "0 meses" no lugar de "não lido".
- **Padrão da mostra é D3 Não|Não** (Logan C1): depois de 28/11 todo canal tem arquivo, então é o caso normal.
- **D3 a 390 px** (C2): rodapé de botões fixo na caixa (o conteúdo rola por dentro), botões empilhados de 44 px, "O que acontece:" em itens curtos (uma frase do spec por item, sem mudar palavra), ordem: lista, o que acontece, "Não dá para desfazer", "Também saem as leituras da forja", D4 + campo, botões. O rótulo do botão reserva a largura do mais longo ("Remover e apagar do arquivo"): não muda de lugar quando a contagem chega.
- **11.3 / D8**: a lista de quatro linhas vira o parágrafo de hoje, e a linha do arquivo continua abaixo como linha da lista. **D5+D8 juntos** têm quadro próprio, sem botão de confirmar. **D5**: as contagens que teriam parcela no arquivo viram "pelo menos N", apoio "a parte no arquivo não foi lida"; status "Remover fica disponível quando a leitura do arquivo der certo".
- **11.5**: a parcela só aparece quando há parte só no arquivo (D4); o apoio de hoje fica e recebe a parcela ("views diárias dos vídeos; 392 dias no arquivo"). Sem parcela (D3, canal novo) nada de "0 no arquivo".
- **D4** (C5, 11.2): nome em negrito, selecionável, em caixa própria; rótulo "Nome do canal"; campo logo acima dos botões; comparação sem caixa, acento, emoji e espaço repetido (`mochilao  PELO mundo` libera o botão); colar permitido; status `role="status"`: "Digite o nome do canal para continuar." / "Nome confirmado." Sem cor nova (contorno forte + caixa de arquivo). O código de 8 caracteres do `sem_destino` (11.2) NÃO foi desenhado: não há estado dele no plano M4.
- **D6** (11.10): a frase da casa fora aparece antes do clique só em Sim|Sim (octógono vermelho a partir de 36 h; triângulo âmbar abaixo disso é o limite que fica no ⓘ da peça 2); em Não|Não e Não|Sim o D6 é igual ao D3, e a frase só vem no retorno.
- **D7** (C6): título + a frase + "Fechar" (não "Cancelar"); nada é contado. Administra x só edita, antes x depois de 24/10, um x dois meses.
- **D9** (C4, novo): "Não foi possível confirmar se o canal foi removido: a conexão caiu. Recarregue a lista para ver." + "Recarregar a lista". "continua no observatório" só quando o servidor recusou (D7r).
- **Retorno depois do clique** (C3): deixa de ser toast verde que some. Sem arquivo e sem imagens (R1): toast `ok` com temporizador, "Canal removido em 14/10. Não havia arquivo: nada a limpar." Sem arquivo com imagens (R2): neutro. **Com arquivo (R3): toast persistente, neutro, que só sai com "Entendi"**, com o prazo de 30 dias na combinação Sim|Sim ("até 13/11 (30 dias). Ponha um lembrete no celular") e a frase de "não há nada a fazer" nas outras; a frase da casa fora entra no fim.
- Linguagem: "snapshots do NAS" só no ⓘ; nenhuma palavra proibida da CONV §1.8 fora das exceções do Logan (11.1).

## O que o dono testa no Opera
1. D3 Não|Não a 390 px (tema claro): o botão e "Cancelar" ficam à vista sem rolar; a lista de "O que acontece" lê-se de relance.
2. Alternar Comando|Bloco: a frase muda, nunca promete data que não existe ("ainda não tem data para chegar" x "chega em 12/12").
3. D4a: botão desabilitado (tracejado) até o nome bater; testar sem acento, sem o emoji, com maiúscula, colando; com o nome de 100 caracteres.
4. D5: sem botão de confirmar; "Tentar de novo" mostra "Lendo o arquivo…"; nada diz "0".
5. D7 como administra e como só edita; D9.
6. Clicar em "Remover…" em D1, D2 e D3: o retorno muda (R1, R2, R3); R3 não some sozinho. "Ver os comandos" (botão ao lado de "Entendi", só em R3 Sim|Sim) não navega no mockup: leva ao bloco Canais removidos da página do Arquivo, que ainda não foi desenhado.
7. Tab, Shift+Tab, Esc (fecha) e o foco inicial em "Cancelar".

## Em aberto
- Quais contagens têm parcela só no arquivo (desenhei versões e dias de registros): do Phil.
- Os números (14 meses, 31.402 registros, 9 imagens, datas) são exemplo.
- A sugestão do Logan (régua de quatro etapas em miniatura sob "O que acontece") não foi desenhada.
- Logan propôs faixa persistente no topo da tela para Sim|Sim; pediu-se toast persistente, e foi o que se desenhou (vale para os três casos com arquivo): confirmar com ele.

## Rodada 2 (14/10/2026): correções de Logan (K1, K2) e Naksu (RC-1 a RC-3)
- K1: D5 e D5+D8 dizem "a parte no arquivo ficou fora da conta". K2: em R3 "Sim | Sim", "ver os comandos" era link na frase (rodada 2) e virou botão (K3, rodada 3, abaixo) e a última frase é "a página do Arquivo só avisa quando você a abre".
- RC-1: ao abrir D4a/b/c, o corpo rola até o campo do nome (`scrollIntoView` de `#rcIn`); a 390 px o campo e o status ficam acima do rodapé.
- RC-2: "Não dá para desfazer" sobe para antes de "O que acontece:" em D3 e D4 (a 390 px, D3: y 473-515, acima da dobra de 708). RC-3: título limitado a 3 linhas só quando o D4 existe (nome completo na caixa e no `title`).
- Medido de novo (390 e 1440, claro e escuro, D3, D4a/b/c, D4a com 100 caracteres, D5, D5+D8, R3 Sim|Sim): zero `color-mix`, rolagem horizontal 0, alvos < 44 px a 390 = 0, contraste < 4,5:1 = 0. Capturas regravadas em `shots/`.
- Exceção do 11.1 registrada em `../../2026-10-13-a5-lote-2/CONVENCOES.md` §1.8.

## Rodada 3 (14/10/2026): correções do Logan (K3, K4)
- K3: em R3 Sim|Sim a frase do prazo volta a ser corrida ("Próximo passo: rodar o comando no Mac até 13/11 (30 dias)."), sem link; "Ver os comandos" é botão `btn small` à esquerda de "Entendi" no rodapé do aviso (44 px a 390 px, 32 px a 1440; `#rcCmd`, não navega no mockup).
- K4: regravados com o `rc.js` atual todos os `*-alto-*` e `index-e-r3-cap-ss-*`; `index-r-r3-cap-ns-*` regravado; `index-r-r3-cap-ss-*` apagados (o `index-e-r3-cap-ss-*` cobre o estado).
- Medido de novo (390 e 1440, claro e escuro, estados regravados): rolagem horizontal 0, zero `color-mix`, alvos abaixo de 44 px a 390 = 0, texto e botão do aviso #231C14 sobre #FBF7F0 (claro) e #F5EFE6 sobre #221E1A (escuro), acima de 4,5:1.
