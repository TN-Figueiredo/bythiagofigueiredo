# Conferência do Logan: peça 8, rodada 1

Conferência dos meus achados de REVISAO-LOGAN-PECA8-1.md, aberto em Playwright sobre file:// a 390 px (peca8-estados, peca8-canal canal e vídeo). Erros de script 0. Não conferi: leitor de tela, aparelho real, 1440 px nesta rodada (a correção não mexe em layout).

## Achados
- **B1 resolvido.** 14 "Pode esperar" e 10 "Nada a fazer" nos estados; novos registros, leitura desligada, mês de espera, diálogo ("Não há pressa") com a linha. "Ver o comando" agora abre um `<pre>` com a linha, Copiar e "Já rodei". Pendente que não é meu: Phil confirmar "pode esperar" para leitura atrasada.
- **B2 resolvido.** "quem cuida" = 0 ocorrências; "avise o Claude Code, ao voltar"; ⓘ diz que o Cowork não muda variável do Vercel.
- **C1 resolvido.** Uma frase só, datas coerentes, mais `?vs=semat` com triângulo âmbar para 150 dias.
- **C2 resolvido no escopo que pedi.** "desde" = 0 nos estados; gráfico, caixa e marcas usam trecho. Resta "Sem leitura desde 14/03/2028" no âmbar de atraso: é a frase do spec e aqui "desde" marca um evento (última leitura), aceito.
- **C3 resolvido** (link para a ficha da peça 6). **C4 resolvido** ("N" = 0, "pelo menos 12"). **C5 resolvido** ("lido em dd/mm/aaaa"). **C6 resolvido** ("cancele, fixe o vídeo na tela dele e volte aqui").
- **Frase-resumo e "Agora" resolvidos:** "37 de dezembro de 2027 podem ir para o arquivo, sem pressa. 9 esperam o prazo da cópia."; linha "Esperando você".
- S4 resolvido (Mostrar mais da lista principal funciona).

## Decisões do desenhista
1. **"No arquivo (enviado em dd/mm)": aprovo.** É data de evento, que o dono confere; "desde" ali afirmaria um trecho que a linha do mês não mostra.
2. **"03/2024 a 20/02/2027 no arquivo": aprovo.** Trecho com começo e fim, mais "A coleta começou em 03/2024" explica o começo. Fica no vídeo e conforma com a remessa L39/L476/L485 ao spec.
3. **Comando `npm run obs:videos-desfazer -- 2028-04`: aprovo como exemplo de mockup, com condição de plano.** A emenda deve criar o comando, com o mês como único argumento, idempotente (a tela já diz "segura de rodar mais de uma vez"), recusando mês fora de "passou à leitura mensal" com mensagem em português. Se o dono preferir a regra "arquivo gravado + uma linha que o roda" da peça 7, o comando grava o arquivo e imprime a linha; decidir na emenda, a tela serve aos dois.
4. **Foco do "Mostrar mais" no primeiro vídeo novo: aprovo.** Confirmado: o foco cai no primeiro vídeo novo ("Pernambuco de ônibus..."), nunca no body; o dono de teclado continua de onde parou.

## Acordo
**Acordo do Logan para a peça 8**, vale para canal, vídeo e a seção "Vídeos antigos". Condições fora da tela: Phil sobre "pode esperar" na leitura atrasada; emenda do comando; remessas L501, L509, L511, L476, L485, L39 e o ⓘ do automático ao fecho do spec 04.
