# Revisão do Logan (UX) sobre o DESENHO da M4, rodada 2

14/10/2026. Sem navegador (pedido do controlador). Lidos: `remover-canal/rc.js`, `rc.css` (trechos do link e do título), `NOTAS.md` (rodada 2), `bl2.js` L297 e `NOTAS-18-v2.md` (rodada 2), `CONVENCOES.md` §1 item 8. Capturas olhadas: `index-e-d3-390-claro`, `index-e-d4a-390-claro`, `index-e-d4a-nome-longo-390-claro`, `index-e-d4c-nome-longo-alto-390-claro`, `index-e-d5-390-claro`, `index-e-r3-cap-ss-390-claro`, `index-r-r3-cap-ss-390-claro`, `18-v2-caso-v9-390-claro`.

## Resumo

| Mockup | Veredito |
|---|---|
| Diálogo "Remover canal" | **ACORDO COM CONDIÇÕES** (K3 e K4, abaixo; os dois são pequenos e não reabrem o fluxo) |
| 18-v2 | **ACORDO** |

## Conferência pedida

| Item | Resultado | Evidência |
|---|---|---|
| K1 (D5, D5+D8: "não foi lida") | **Resolvido.** "a parte no arquivo ficou fora da conta" nas duas linhas. | `rc.js` L79; captura `e-d5-390-claro` |
| K2 (R3 Sim, Sim: caminho e "a página") | **Resolvido no texto**, com defeito novo na forma (K3). "ver os comandos" é link; "a página do Arquivo só avisa quando você a abre." | `rc.js` L164; captura `e-r3-cap-ss-390-claro` |
| Exceção do 11.1 no `CONVENCOES.md` §1.8 | **Resolvido.** "snapshot(s) do NAS" e "lido em dd/mm" (sempre com data) permitidos; "lido" solto continua proibido. Bate com o que eu pedi. | `CONVENCOES.md` L18 |
| "Não dá para desfazer" antes de "O que acontece:" (D3, D4) | **Acordo.** Resolve o meu S1: a 390 px, em D3, a frase está acima da dobra (captura `e-d3-390-claro`). A ordem ficou: o que se perde, que não volta, como acontece. É a ordem certa para quem decide. | `rc.js` L142 |
| Título com até 3 linhas no D4, nome inteiro no `title` | **Acordo.** O nome inteiro, que é o que a pessoa digita, continua visível sem corte na caixa do D4, logo acima do campo (captura `e-d4a-nome-longo-390-claro`). O `title` não é visto no celular, mas também não precisa ser: a caixa já faz esse papel. | `rc.js` L176, `rc.css` L152 |
| 18-v2, V9 com "não medido" em Exportações | **Acordo.** "não medido" + "a leitura de hoje não chegou: não dá para dizer se alguma espera confirmação". Nunca "0 exportações". "leitura" não é palavra proibida. | `bl2.js` L297; captura `18-v2-caso-v9-390-claro` |

## Achados novos

**K3. R3 Sim, Sim a 390 px: o alvo de 44 px do link, dentro da frase, parte a frase do prazo** (corrige)
- Falha: o link inline com `min-height:44px; line-height:40px` (`rc.css` L154) abre um vão de linha e deixa o ")" sozinho no começo da linha seguinte: "rodar o comando no Mac (**ver os comandos** / ), até 13/11 (30 dias)".
- Por que: a data é o único dado com prazo da remoção, e ela fica partida no meio da frase mais importante do aviso. Quem lê na rua, de relance, lê "rodar o comando no Mac (" e perde a ligação com "até 13/11". Ação dentro de parêntese também não é o padrão conhecido: em um aviso que fica na tela até o toque, a ação vai como botão no rodapé (snackbar com ação, Gmail, Android).
- Evidência: captura `index-e-r3-cap-ss-390-claro.png`.
- Custo: o dono lê a frase em dois pedaços e pode não ligar o comando à data.
- **Troca exata:** no ramo `CAP === 'ss'` de `retorno()`, o texto fica "Falta apagar o arquivo dele: 14 meses. **Próximo passo: rodar o comando no Mac até 13/11 (30 dias).** Ponha um lembrete no celular: a página do Arquivo só avisa quando você a abre." O link sai da frase e vira botão `btn small` "Ver os comandos" no rodapé do aviso, à esquerda de "Entendi" (a mesma linha de "Fica na tela até você tocar em Entendi."; a 390 px, se não couber, o texto de apoio sobe e os dois botões ficam lado a lado). Com isso a regra do alvo de 44 px vale para o botão, e a frase volta a ter linha normal. **Para a Naksu:** conferir a linha do rodapé com os dois botões a 390 px.

**K4. Capturas antigas na pasta `shots/` mostram o texto da rodada 1** (corrige, higiene)
- Falha: os arquivos `index-r-r3-*` e todos os `*-alto-*` são das 10:56, antes da rodada 2 (o `rc.js` é das 11:12). `index-r-r3-cap-ss-390-claro` ainda diz "(ver os comandos)" sem link e "a página só avisa"; `index-e-d4c-nome-longo-alto-390-claro` ainda mostra "Não dá para desfazer" depois de "O que acontece:".
- Custo: quem comparar a captura com a tela (o dono, o Gio, a próxima revisão) vê duas versões do mesmo estado e não sabe qual vale.
- **Troca exata:** regravar os `*-alto-*` com o `rc.js` atual e apagar os `index-r-r3-*` (os `index-e-r3-*` já cobrem o retorno), ou regravá-los também. A linha "Capturas regravadas em `shots/`" das NOTAS passa a ser verdade para a pasta inteira.

**S7. D4 a 390 px abre já rolado até o campo: o título e a lista do que se perde ficam acima, sem nada visível dizendo que há conteúdo ali** (sugestão; troca declarada com o RC-1 da Naksu)
- Captura `e-d4a-390-claro`: a primeira coisa que se vê é o fim de "Não dá para desfazer". Aceito o RC-1: para digitar o nome a pessoa teria de rolar de qualquer jeito, e a caixa do D4 repete o essencial ("13 desses meses ... **Eles se perdem de vez**" + o nome). Registro o custo: quem quiser rever os números rola para cima sem aviso de que há o que ver. Se a Naksu tiver uma sombra no topo do corpo quando ele está rolado (a mesma do S1 no rodapé), resolve. Não é condição.

**S6 (rodada 1) continua aberta** no 18-v2: "não foi lido por inteiro" (`bl2.js` L297, ramo V10) e "Volta quando o banco puder ser lido." vêm do 18 aprovado, e a exceção nova do §1.8 os reprova explicitamente ("lido" solto). Continua sugestão para o próximo lote, não condição deste mockup: "não respondeu por inteiro", "Volta quando o banco responder."

## O link "ver os comandos" para `#canais-removidos`, que não existe no mockup

**Não importa para o dono testar, desde que ele saiba.** O que ele testa no R3 é se o aviso fica na tela, se diz o prazo e se aponta um caminho; o destino é o bloco "Canais removidos" da página do Arquivo, que não é deste mockup. O risco é o dono tocar, nada acontecer (`onclick="return false"`) e anotar como defeito. **Condição leve, junto do K3:** no item 6 de "O que o dono testa" das NOTAS, acrescentar "Ver os comandos não navega no mockup: leva ao bloco Canais removidos da página do Arquivo, que ainda não foi desenhado." Na tela real, a âncora tem de cair no bloco, não no topo da página (como pedi no K2).

## O que eu NÃO verifiquei
- Nada em navegador: o rolar até o campo do D4, o foco, Tab e Esc foram lidos no código.
- Os demais estados do 18-v2 da rodada 2 (V1a, V1b, V2, V4, V5, V6) não foram reabertos: só o V9 estava no pedido.
- Leitor de tela (o `title` do título no D4 e o link dentro do aviso), rede lenta e aparelho real.
