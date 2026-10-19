# Mockup: original em alta resolução no A/B Lab (r4)

Abrir: `open -a Opera index.html`. Dados sintéticos. Tokens com rgba/hex literais (sem color-mix), botões de 36 px (44 px a ≤480 px) com borda `--btn-ctl`, escala de espaçamento 4/8/12/16/24. Dois temas, 1440 e 390 px. Medido com Playwright: `scrollWidth` 1440 = 1440 e 390 = 390; Tab chega à área de envio com contorno de foco; nenhum "undefined" no DOM. Capturas em `shots/r4-*.png`.

## Onde entra
No passo Variantes do assistente, logo acima do cartão A, só para os tipos thumbnail e combo. Em teste só de título não há bloco nem a linha em G.

## O que cada estado mostra
- A. Pública em alta (1280×720): confirma a origem; "Enviar original" é um link (rótulo de um input de arquivo, com foco por teclado).
- B/E. Com a pública baixa e sem original guardada, Próximo fica desabilitado (aria-disabled) com o motivo ao lado.
- B. Pública baixa (480×360 e 640×480, as duas 4:3 com faixa preta): selo, prévia borrada, aviso dizendo em uma frase que o envio é necessário para iniciar e por quê. Um só caminho: a área de envio inteira (label de input file, mínimo 120 px de altura). Rótulo "Arquivo original (obrigatório)". Não existe seguir com a baixa. No celular o texto vira "Escolher arquivo".
- C. Arquivo enviado: pública "Não será usada" × enviada "Será usada". Com a pública baixa só há "Trocar arquivo"; "Remover e usar a pública" fica só com a pública em alta (A).
- D. Inválido, quatro casos (pequeno, proporção, formato, mais de 2 MB), cada um com o que fazer.
- E. Três cartões: enviando (barra, "Cancelar envio" volta a B, sem o arquivo); conexão caiu (original não guardada, "Tentar de novo" reenvia o mesmo arquivo, passo segue livre com a pública); YouTube recusou a imagem (a original continua a pública).
- F. Rascunho reaberto (uma só faixa verde, fundida): o passo abre em C, não em B; a original enviada continua guardada no servidor (a spec do assistente hoje zera `thumbFile` ao salvar: o servidor precisa guardar o envio ao terminar E).
- G. Resumo: linha "Original para restaurar" nos três casos. Com pública baixa e sem envio, "Iniciar teste" fica desabilitado (aria-disabled), com o motivo visível ao lado e a ação "Enviar original" (leva ao passo Variantes com foco na área, mantendo o preenchido; o Próximo volta ao resumo). Sumiu "Iniciar mesmo assim".
- H. Detalhe do teste: "Original guardada" com origem e resolução; testes antigos com pública baixa mostram o aviso e "Enviar original" (só com o teste pausado ou rascunho).

## Decisões (1, 3, 4 e 6 aprovadas pelo dono com a recomendação)
1. Limite de "baixa". Posição do desenho: largura até 480 avisa (regra do diálogo de encerrar). Posição do Logan: aviso sempre que a pública tiver menos de 1280 de largura, pois 480×360 e 640×480 são 4:3 com faixa preta e a 640×480 passaria calada. **Recomendo a do Logan** (o mockup já a mostra); o diálogo de encerrar segue a regra do Phil até ele dizer se alinha. Falta conferir com dois vídeos reais do canal se `sddefault` vem sempre com faixa preta.
2. Enviar original é obrigatório quando a pública < 1280 (dono, 19/10): sem envio, não inicia.
3. Mínimo no envio: 1280 com a pública baixa (dono 19/10); com a pública em alta, 640; 1280×720 como ideal no texto.
4. Trocar a original só com teste pausado ou rascunho (trocar no ar muda a base do experimento). Logan concorda.
5. "Remover e usar a pública" só com a pública em alta (dono, 19/10).
6. Limite do YouTube lido como 2 MB e JPG, PNG, GIF; a recusa ao guardar tem mensagem própria (E). Logan concorda.
7. Decidido pelo dono 19/10: retomar livre com aviso (teste antigo com a original baixa não fica preso por regra nova; custo: volta borrada a cada troca). H mostra esse caminho.

## O que testar no Opera
- Escuro e claro: selo e faixa de aviso se leem sem depender só da cor.
- A 390 px: área de envio com 120 px, botões em coluna de 44 px, nada corta.
- Teclado: Tab chega à área de envio (contorno laranja) e aos links.
- Ler as mensagens de D, E e F e dizer se cada uma diz o que fazer.
