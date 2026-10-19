# Mockup: original em alta resolução no A/B Lab

Abrir: `open -a Opera index.html`. Dados sintéticos. Tokens `--cms-*` com rgba/hex literais (sem color-mix), botões de 36 px com borda `--btn-ctl`, escala de espaçamento 4/8/12/16/24. Dois temas, 1440 e 390 px. `scrollWidth` medido com Playwright: 1440 = 1440 e 390 = 390 (sem rolagem horizontal). Capturas em `shots/` (página inteira).

## O que cada estado mostra
- A. Pública já em alta (1280×720): só confirma de onde vem a original; "Enviar original" fica como link discreto.
- B. Pública baixa (480×360) sem envio: selo "Baixa resolução", prévia borrada ao lado da área de envio, aviso com a consequência em uma frase, botões "Enviar original" e "Seguir com a baixa resolução". A frase de baixa resolução vem do diálogo de encerrar, com o mesmo padrão de faixa e selo.
- C. Arquivo enviado: pública × enviada lado a lado, selos "Não será usada" e "Será usada", dimensões e tamanho.
- D. Inválido, quatro casos: pequeno demais (mínimo 640 de largura), proporção errada, formato (só JPG, PNG, GIF), maior que 2 MB. Mensagem exata, sem prévia, área de envio pronta.
- E. Enviando: barra de andamento, botão primário desabilitado, "Cancelar envio".
- G. Resumo antes de "Iniciar teste": linha "Original para restaurar" nos três casos (enviada, pública boa, pública baixa). No caso baixo o botão vira "Iniciar mesmo assim" e aparece "Enviar original".
- H. Detalhe do teste: linha "Original guardada" com origem (enviada × cópia pública) e resolução; link só para teste pausado.

## Decisões em aberto para o dono
1. Limite de "baixa": hoje largura até 480 avisa (regra do diálogo de encerrar). Recomendo manter; 640 a 1279 passa sem aviso, mas o selo mostra a resolução.
2. Enviar original é obrigatório quando a pública é baixa? Recomendo não: aviso + "Iniciar mesmo assim", para não travar teste urgente.
3. O mínimo aceito no envio: 640 de largura (regra do YouTube para thumbnail personalizada). Recomendo 1280×720 como "ideal" no texto e 640 como piso.
4. Trocar a original com o teste em andamento: recomendo só pausado ou rascunho, porque trocar a A com o teste no ar muda a base do experimento.
5. "Remover e usar a pública": recomendo manter, para desfazer o envio sem sair do passo.
6. O "limite do YouTube" do brief foi lido como 2 MB e formatos JPG, PNG, GIF; se houver outro limite (ex.: recusa do YouTube ao guardar), falta a mensagem.

## O que testar no Opera
- Alternar escuro e claro: o selo e a faixa de aviso se leem sem depender só da cor (ícone e texto).
- A 390 px: botões em coluna, prévias empilhadas, nada corta.
- Teclado: Tab chega aos botões com foco visível.
- Ler as quatro mensagens do estado D e dizer se cada uma diz o que fazer.
