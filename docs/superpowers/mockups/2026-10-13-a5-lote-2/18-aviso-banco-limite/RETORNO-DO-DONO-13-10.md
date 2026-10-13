# Retorno do dono sobre o mockup 18 (13/10/2026, ~14:50): NÃO aprovado, pede ajuste

Palavras dele: "Acho que tem que fazer ajuste. 500 MB é para tudo, não é só para isso, né? Então talvez exibir percentual, mas não falar os valores e tal. Talvez até ter um botão ou cron em quando chegar em algum percentual mandar para o nosso backup no NAS eventualmente, né? Quando chegarmos nessa parte."

## O que muda (interpretação do controlador, a confirmar com ele na reapresentação)
1. O limite de 500 MB é do banco INTEIRO do site, não do Observatório. A tela não pode dar a entender que o Observatório tem 500 MB só dele.
2. A leitura principal passa a ser PERCENTUAL do limite ("Banco do site: 43% do limite"), na pastilha, na barra, na frase e na régua. Os valores absolutos em MB saem da pastilha e do corpo do painel; ficam, no máximo, dentro do botão de informação (método), para quem quiser a conta.
3. Os cortes viram percentuais: 70% (350 de 500) e 85% (425 de 500). A previsão continua em dias e data.
4. "Quem ocupa" passa a mostrar a PARTE de cada um em percentual do banco (e do crescimento), sem MB no corpo. Deixar explícito que o Observatório é uma parte do banco do site.
5. Fora desta tela, para a fase de manutenção com o NAS (spec à parte): ao chegar a um percentual, mandar para o backup no NAS, por botão ou por cron. Aqui só cabe um lugar reservado, marcado "ainda não existe", SE couber sem poluir; não desenhar a funcionalidade.
6. Ponto levantado pelo controlador e ainda sem resposta do dono: a palavra "lote" na tela ("2 lotes a confirmar") é jargão interno (o código da A4 tem teste que a proíbe em frase de tela). Trocar por "exportações a confirmar" (padrão adotado até ele dizer outra coisa).
