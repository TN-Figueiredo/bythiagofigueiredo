# A/B Lab honesto: roteiro, estado e horas (documento vivo)

Criado em 14/10/2026 a pedido do dono, para ele saber a qualquer hora onde estamos e o que falta.
**Atualize a coluna "Estado" (e a data) toda vez que uma etapa andar.** Spec:
`docs/superpowers/specs/2026-10-07-ab-lab-honesto-design.md`.

## Regras deste documento

1. **A numeração nunca muda.** Etapa nova no meio do caminho ganha subnúmero (17.1, 17.2, 3.1); etapa
   que sai fica na tabela com o estado "saiu" e o motivo. Nada é renumerado.
2. **Quem testa é o controlador com o Gio** (decisão do dono, 14/10): testes automatizados, prova local,
   capturas, conferência em produção, paridade pelo pipeline, ensaios. **O dono só confirma** que
   "aparentemente está bom", olhando o resultado que o Gio entrega. Onde um plano diz que o dono abre,
   confere, cola ou testa, quem faz é o controlador com o Gio, e o dono recebe o resultado para
   confirmar. **Ficam com o dono só as mãos que uma regra fixa reserva a ele:** aplicar migration em
   produção; autorizar escrita no canal do YouTube (portão da imagem, ensaio) e escolher o vídeo;
   aprovar mockup; dar o "pode" de plano; operar o Cowork, que é dele (o Gio prova a paridade pelo
   pipeline com a chave e pelo MCP; a conferência dentro do Cowork, se ainda for preciso, é um texto
   que o dono cola e devolve). Produção logada no CMS: o Gio tenta; se o Turnstile barrar, o dono só
   faz o login e o Gio segue.
3. **As horas são estimativa do controlador, não medida.** Base: o planejamento de P1 e P2 (inventário,
   dois planos, duas rodadas de revisão) levou cerca de 1 h 25 min de relógio em 13/10. Execução de
   código não tinha medida nesta trilha. Ao fechar cada etapa, anote as horas reais na coluna própria:
   é o que corrige as próximas estimativas.
4. "Agentes" é relógio com a sessão trabalhando (inclui os testes do Gio); "Dono" é a mão dele;
   "Espera" é calendário que ninguém acelera.

## Trecho 1: até o primeiro teste A/B

| # | Etapa | Estado (data) | Agentes (estim.) | Dono (estim.) | Espera | Horas reais |
|---|---|---|---|---|---|---|
| 1 | Respostas do dono: "pode" de P1 e P2; perguntas 13, 14, B1, B2, B3 | pendente (14/10) | — | 15 min | — | |
| 2 | P1: execução, testes, capturas, revisão do lote, envio, conferência em produção | plano fechado (13/10) | 3,5 a 5,5 h | 10 min (confirmar capturas; colar o `update` dos alertas) | conferência do cron no dia seguinte e em D+7 (Gio) | |
| 3 | P2: execução, testes, capturas, revisão, envio, conferência em produção | plano fechado (13/10) | 5,5 a 9 h | 15 min (confirmar; autorizar a C1 de produção) | cron do dia seguinte (Gio) | |
| 4 | Emenda v7 do spec: revisão de Phil e Yannis, corpo reescrito, Gio no aceite | rascunho (14/10) | 2 a 3 h | 10 min | — | |
| 5 | P3: plano | não começou | 2 a 3 h | 5 min ("pode") | — | |
| 6 | P3: execução, testes, capturas, envio, conferência | não começou | 5,5 a 9 h | 10 min (confirmar) | P2 em produção antes | |
| 7 | P4-0: script do portão da imagem e execução | não começou | 2 a 3 h | 10 min (escolher o vídeo, autorizar) | algumas horas com a thumbnail de teste | |
| 8 | Mockup do diálogo "O que fica no vídeo?" e da faixa (duas versões) | não começou | 2 a 4 h (mais 1 h por rodada extra) | 20 min por rodada (aprovar no Opera) | — | |
| 9 | Migration A e Migration 0 | não começou | 1,5 a 2,5 h | 15 min (aplicar) | vez na fila do banco: antes de 16/10, ou entre a MG15 aplicada e 30/10 | |
| 10 | P4a: plano (escreve no YouTube; revisão em `high`) | não começou | 4 a 6 h | 5 min ("pode") | v7 de acordo | |
| 11 | P4a: execução, testes, capturas, envio | não começou | 11 a 17 h | 10 min (confirmar) | Migration 0, mockup e P4-0 prontos | |
| 12 | Emenda da E18 (ordens 3, 3b, 4, 4b) | fora desta trilha (outro terminal) | — | — | antes do primeiro teste | |
| 13 | Ensaio da P4a num vídeo do dono (Gio conduz) | não começou | 2 h | 10 min (autorizar, escolher o vídeo, confirmar) | 2 dias de calendário (rotação das 05:00) | |
| | **Soma do trecho 1** | | **cerca de 41 a 67 h** | **cerca de 2 a 3 h** | | |

As etapas 4, 5, 7 e 8 correm em paralelo com 2 e 3; o calendário é menor que a soma. Sem data: a fila
do banco e a árvore dividida com o outro terminal pesam mais que as horas.

## Trecho 2: depois do primeiro teste

| # | Etapa | Estado (data) | Agentes (estim.) | Dono (estim.) | Espera | Horas reais |
|---|---|---|---|---|---|---|
| 14 | P4b: plano, execução, testes | não começou | 6,5 a 10 h | 10 min | P4a em produção | |
| 15 | Migration B | não começou | 2 a 4 h | 20 min (`pg_dump`, aplicar) | 7 dias de P3 no ar; irreversível | |
| 16 | Spec da medição nova (impressões reais por variante) | **não existe** | 3 a 5 h (só o spec) | 20 min | — | |
| 17 | Spec de "Candidatos a teste" (substitui o alerta de fadiga) | **não existe** | 3 a 5 h (só o spec) | 20 min | P1 em produção | |
| 18 | Telas do A/B (acompanhamento, views por variante): mockup, plano, execução | não começou | sem estimativa (depende de 16 e 17) | rodadas de mockup | MG14 em produção | |

## O que pode pegar o dono desprevenido

- **Aprovar:** capturas de antes e depois em P1, P2 e P3 (retiradas, sem mockup); o mockup da P4 no
  Opera; o "pode" de cada plano.
- **Colar ou aplicar:** o `update` dos alertas pendentes (P1); as migrations A e 0; o `pg_dump` e a
  Migration B. O agente prepara cada comando, um por linha.
- **Autorizar escrita no canal:** o portão da imagem deixa um vídeo algumas horas com thumbnail de
  teste; o ensaio da P4a cria um teste de verdade num vídeo, em dois dias seguidos.
- **Fila do banco:** a partir de 16/10 e de 30/10 há dias em que nenhuma migration nasce nem é aplicada
  (migrations destrutivas da A5).
- **Não iniciar teste A/B antes do ensaio da P4a:** a tela não impede.
- **Árvore dividida com o outro terminal:** cada junção de volta ao `staging` local pede o outro
  terminal parado por alguns minutos.

## Histórico de mudanças deste documento

- 14/10/2026: criado (etapas 1 a 18).
