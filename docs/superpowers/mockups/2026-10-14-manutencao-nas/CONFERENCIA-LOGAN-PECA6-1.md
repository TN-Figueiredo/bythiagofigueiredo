# Conferência Logan, peça 6 "Ver antigo", após a correção da rodada 1 (14/10/2026)

Verificado: leitura de `peca6.js`/NOTAS.md e Playwright em `file://` a 390 px (`?e=pagina&inicio=antes`, 12 e 24 meses; `todos-erro`). Rolagem horizontal 0, erros de script 0. NÃO verifiquei: leitor de tela, rede lenta, aparelho real, 1440 px nesta conferência.

**Acordo: sim.** Pronto para o dono, sob a ressalva do spec abaixo.

| Achado | Resultado | Evidência |
|---|---|---|
| B1 "desde" | Resolvido | Eixo: "25/08 a 30/09/2027 no arquivo", uma vez; legenda e linha de apoio repetidas saíram; `perfil=le` mostra "25/08 a 30/09/2027 no arquivo."; recorte vira "todos os 50 meses (a coleta começou em 03/2024)". |
| B2 "Tudo" | Resolvido | Frase "Tudo passa do que o site guarda (50 meses). Escolha até 36 meses." e Pedir desligado; quadro "pediu demais" mantido, sem "canais". |
| B3 foco | Resolvido | Medido: foco no "Cancelar pedido" após 1,8 s e 3,3 s continua no botão; durante a leitura só texto, barra e aria-valuenow mudam; ao chegar o resultado o foco vai ao painel; `role="status"` anuncia a cada 25%. |
| C1 já lidos | Resolvido | 0 lidos: linha omitida; 1: "Já lido: ..."; 2+: faixa. |
| C2 período | Resolvido | 24 meses: espera "16 de 24"; limite de 12 linhas declarado por escrito na nota do quadro. |
| C3 "Pode esperar" | Resolvido | "Nada se resolve daqui: quando a forja e o NAS voltarem, peça de novo."; "não medido" sem "Pode esperar", só "Abra a página de novo em alguns minutos". Cowork fora, correto. |
| C4 arquivo não bate | Resolvido | Garantia do automático saiu; "Falta 1 de 12 meses: setembro de 2027. Os outros 11 vieram. ... peça ao Claude Code para conferir setembro de 2027." |
| S1 dobra | Parcial, aceito | O painel recebe foco ao abrir (rola até ele); não revalidei o "Pedir" na tela real, fica para a tela implementada. |
| S3 duas datas | Resolvido | "41,2 mil views, lida em 18/02" com apoio "Contagem na passagem à leitura mensal (21/02/2028)". |

## Decisões do desenhista
1. **Título do painel "Ver antigo: o que está no arquivo": aceito.** Substitui a linha de apoio sem repeti-la no botão; o nome do botão e o do painel batem (mesmo conceito, mesmo nome).
2. **S2 não feito: aceito.** Sugestão; só pesa com lista acima de 12 linhas, e o mockup corta em 12 recentes.
3. **S4 não feito: confirmado, nada a mudar.** Spec 04 L39-40: a porta do pedido (peça 6) é "só quem edita o site"; editor e administrador veem o mesmo. O perfil "Edita" do mockup está certo.

## Pendência fora do mockup (não bloqueia)
Spec 04 L39 ainda manda a frase "No arquivo desde mm/aaaa." para quem só lê, e a peça 1 do "desde" foi recusada pelo dono. O mockup já segue o trecho ("25/08 a 30/09/2027 no arquivo."); o spec precisa ser emendado para bater, senão a implementação volta à frase antiga.
