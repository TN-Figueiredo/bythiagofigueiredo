# Mockup: original em alta resolução no A/B Lab (r2)

Abrir: `open -a Opera index.html`. Dados sintéticos. Tokens com rgba/hex literais (sem color-mix), botões de 36 px (44 px a ≤480 px) com borda `--btn-ctl`, escala de espaçamento 4/8/12/16/24. Dois temas, 1440 e 390 px. Medido com Playwright: `scrollWidth` 1440 = 1440 e 390 = 390; Tab chega à área de envio com contorno de foco; nenhum "undefined" no DOM. Capturas em `shots/r2-*.png`.

## Onde entra
No passo Variantes do assistente, logo acima do cartão A, só para os tipos thumbnail e combo. Em teste só de título não há bloco nem a linha em G.

## O que cada estado mostra
- A. Pública em alta (1280×720): confirma a origem; "Enviar original" é um link (rótulo de um input de arquivo, com foco por teclado).
- B. Pública baixa (480×360 e 640×480, as duas 4:3 com faixa preta): selo, prévia borrada, aviso com a consequência em uma frase. Um só caminho para enviar: a área de envio inteira (label de input file, mínimo 120 px de altura). Sem "Seguir com a baixa resolução": o avanço é o Próximo do assistente; a confirmação é uma só, em G. Rótulo "Arquivo original (opcional)". No celular o texto vira "Escolher arquivo".
- C. Arquivo enviado: pública "Não será usada" × enviada "Será usada" (selo corrigido). Só aqui o rótulo é "Original enviada".
- D. Inválido, quatro casos (pequeno, proporção, formato, mais de 2 MB), cada um com o que fazer.
- E. Três cartões: enviando (barra, "Cancelar envio" volta a B, sem o arquivo); conexão caiu (original não guardada, "Tentar de novo" reenvia o mesmo arquivo, passo segue livre com a pública); YouTube recusou a imagem (a original continua a pública).
- F. Rascunho reaberto: o passo abre em C, não em B; a original enviada continua guardada no servidor (a spec do assistente hoje zera `thumbFile` ao salvar: o servidor precisa guardar o envio ao terminar E).
- G. Resumo: linha "Original para restaurar" nos três casos. Com pública baixa, "Iniciar mesmo assim" é a decisão única; "Enviar original" leva ao passo Variantes com foco na área, mantendo o preenchido, e o Próximo volta ao resumo.
- H. Detalhe do teste: "Original guardada" com origem e resolução; link só com teste pausado ou rascunho.

## Decisões em aberto para o dono
1. Limite de "baixa". Posição do desenho: largura até 480 avisa (regra do diálogo de encerrar). Posição do Logan: aviso sempre que a pública tiver menos de 1280 de largura, pois 480×360 e 640×480 são 4:3 com faixa preta e a 640×480 passaria calada. **Recomendo a do Logan** (o mockup já a mostra); o diálogo de encerrar segue a regra do Phil até ele dizer se alinha. Falta conferir com dois vídeos reais do canal se `sddefault` vem sempre com faixa preta.
2. Enviar original não é obrigatório com pública baixa: aviso + uma confirmação em G. Logan concorda.
3. Mínimo no envio: 640 de largura; 1280×720 como ideal no texto. Logan concorda.
4. Trocar a original só com teste pausado ou rascunho (trocar no ar muda a base do experimento). Logan concorda.
5. Manter "Remover e usar a pública". Logan concorda.
6. Limite do YouTube lido como 2 MB e JPG, PNG, GIF; a recusa ao guardar tem mensagem própria (E). Logan concorda.

## O que testar no Opera
- Escuro e claro: selo e faixa de aviso se leem sem depender só da cor.
- A 390 px: área de envio com 120 px, botões em coluna de 44 px, nada corta.
- Teclado: Tab chega à área de envio (contorno laranja) e aos links.
- Ler as mensagens de D, E e F e dizer se cada uma diz o que fazer.
