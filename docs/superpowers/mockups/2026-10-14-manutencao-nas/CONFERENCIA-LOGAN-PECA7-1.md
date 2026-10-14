# Conferência do Logan: peça 7, rodada 1 (só os achados de REVISAO-LOGAN-PECA7-1.md)

Lidos: peca7.js (146 linhas), NOTAS.md bloco da peça 7, fatos do Yannis e do Phil. Não reabri o navegador: a conferência é de texto e estrutura, e a ordem dos blocos está no código (`resumo() + resposta() + lista`). Não verificado: render em 390/1440 depois da correção (fica para a Naksu e o Gio).

| Achado | Estado | Evidência |
|---|---|---|
| B1 comando do dono | Resolvido | Uma linha fixa, sem mês: `npm run obs:arquivo \| ssh forja 'bash -s'`, com botão Copiar; igual nos 3 tempos (muda só título e régua). Painel de 3 passos: rodar, esperar, "Já rodei". Sem scp. Condição declarada pelo Yannis (script hoje inexistente, precisa de tarefa nova) fica com ele, não é da tela. |
| B2 pode esperar x vermelho | Resolvido | "Pode esperar" saiu dos itens. Resumo diz o custo de esperar (fato do Phil) e a condição de rodar de longe (Tailscale + forja ligados, forma condicional do Yannis). Item vermelho: "Passou de 60 dias: é só um lembrete. Quando puder, abra «Ver os comandos» e rode a linha." Tem ação. |
| C1 ordem | Resolvido | resumo, depois "Esperam a sua resposta (2)", depois "Esperam você rodar os comandos". |
| C2 "Já rodei" | Resolvido | Saiu da linha de ações, é o passo 3 dentro do painel; "Desfazer" no estado marcado, com "Volte em até 24 horas". |
| C3 origem do 1b | Resolvido | Título: "A forja não conseguiu conferir o B2 em 02/05." |
| C4 quem faz | Resolvido | "você" / "sozinho" sob cada etapa da régua, sem cor nova. |
| C5 vazia | Resolvido | "Nenhum item espera você rodar comandos." + última conferência. |
| C6 refutado | Resolvido | Frase cita o título do vídeo e diz "A idade continua contando desde 30/03." |
| S1 caixa repetida | Resolvido | Aviso uma vez; as linhas só dizem "Apagar indisponível: veja o aviso acima". |
| S2 não medido | Resolvido | "Última leitura em 02/05: 3 itens, o mais antigo há 62 dias." |
| S3 quem vê | Resolvido (no ⓘ) | "Quem só edita o site vê o resumo e a idade, sem os comandos." |

## O ponto do desenhista: a frase "Esperar não perde nada: o canal já saiu do site…"

Julgamento: o desenhista tem razão, e o defeito é maior que o de comentários. A frase está no resumo, que cobre a lista inteira, e a lista hoje tem dois itens de **vídeo** (não de canal) e um de **comentários**. "O canal já saiu do site" é falso para os três: o fato do Phil é sobre canal removido, e no item de comentários o site ainda tem os comentários (o que espera é a cópia antiga, substituída). A frase afirma mais do que o dado sustenta.

Frase certa, vale para qualquer mistura de itens:

> Esperar não perde nada: nenhum dado do site depende desta lista. As cópias antigas só continuam no NAS e no B2 até você rodar a linha, e somem uns 45 dias depois de você rodar.

Pedido ao Phil (não é meu): confirmar que "uns 45 dias" (14 de snapshot + 30 de versões do B2, contados do `rm`) vale também para a cópia antiga de comentários e de vídeo, não só de canal removido. Se não valer para um tipo, a frase perde o "uns 45 dias" para esse tipo, e não o "não perde nada".

## Veredito da peça 7

**Pronto para o dono, com uma condição:** trocar a frase do resumo pela acima (uma linha de texto em peca7.js, função `resumo`). Sem outro achado aberto, nenhum achado novo. Acordo do Logan dado nessa condição; Naksu e a skill frontend-design seguem com a parte deles.
