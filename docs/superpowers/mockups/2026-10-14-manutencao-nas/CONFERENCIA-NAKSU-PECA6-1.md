# Conferência Naksu, peça 6 ("Ver antigo"), rodada 1 corrigida

Só os achados de REVISAO-NAKSU-PECA6-1.md. Playwright, servidor 47702 (derrubado; 47701 do dono intacta), 2 temas x 1440/390. Capturas em `revisao-naksu-shots/peca6-conf/`. Nada editado.

## Veredito: VOLTA PARA AJUSTE por uma linha de CSS (C3). B1 e C1 fechados.

| Achado | Estado | Evidência |
|---|---|---|
| B1 foco morre no tick | FECHADO | Após Pedir: foco em `#va-painel`; Tab leva a "Cancelar pedido"; 9 leituras a cada 600 ms (5,4 s, a casa passa de "enviado" a "lendo" e de 0 a 6 de 12): `activeElement` = "Cancelar pedido" em todas, 4 combinações. Fim da leitura: foco em `#va-painel`. Só texto, largura e `aria-valuenow` mudam por tick. |
| C1 status | FECHADO | 1 `role="status"` (`#vaSt`), fora de `#va-vivo`; 0 `aria-live` no painel. Anuncia marcos: "Pedido feito às 14:32. Aguardando a casa.", "Lendo: 6 de 12 meses." (a cada 25%), "Veio tudo: 12 meses.". `aria-valuetext="6 de 12 meses"` presente. Erros em `role="alert"` (lido no código). |
| C2 coluna sem rótulo | FECHADO | `.v` = "118 mil views"; a 390 o número sobe para a linha do nome; lista de 12 meses 998 px (era ~1.900); a 1440 655 px. hs = 0. |
| C3 barra indeterminada com movimento reduzido | NÃO FECHADO | Regra existe (m19.css L360, listras `--dim`), mas o `style="width:35%"` inline de `barra()` (peca6.js, `<i style="width:35%">`) vence a regra sem `!important`. Medido com `reducedMotion:reduce`: `i` = 364 de 1042 px (1440) e 114 de 328 px (390); `animationName: none`, `background-image` listrado aplicado. Resultado: faixa listrada de 35% parada, ainda lê como progresso parcial. |
| S1 a S4 | S2 feito ("Não veio: o NAS parou." nos 2 meses); S3 feito (`.m-va-sub`, `.m-va-falso` aria-hidden, "Tudo" desabilita o Pedir); S1 e S4 seguem como sugestão ("Claude Code" ainda na frase do octógono, para o Logan). |

### Correção do C3 (corrige)
No bloco `@media (prefers-reduced-motion:reduce)` de m19.css L360: `.m-va .m-bar.ind i{width:100%!important;background:repeating-linear-gradient(135deg,var(--dim) 0 6px,transparent 6px 12px)}`. Aceite: com movimento reduzido, `i` mede a largura da barra (1042 / 328 px). Sem movimento reduzido nada muda.

## Medidas dos elementos mudados

| Item | Claro | Escuro | Exigência |
|---|---|---|---|
| Texto "Pedir" desligado sobre `--sunk` (94,82,64 / 242,235,223; 168,157,136 / 22,19,15) | 6,43 | 6,92 | 4,5 (desabilitado é isento; passa mesmo assim) |
| Borda tracejada do desligado sobre painel | 5,59 | 4,86 | 3 |
| Frase do aviso do "Tudo" (14,5 px) sobre painel | 15,76 (herdado, texto `--text`) | 14,48 | 4,5 |
| Listra `--dim` sobre `--sunk` (barra "enviado") | 5,04 | 5,44 | 3 |
| Alvo "Tudo" (seletor) | 44 x 61 | 44 x 61 | 44 |
| Alvo "Pedir" desligado / "Cancelar pedido" a 390 | 44 | 44 | 44 |
| Alvos a 1440 (ponteiro fino, 4 abaixo de 44: ⓘ, botões 36) | herdado das peças 1 a 4 | igual | n/a |
| Rolagem horizontal (4 combinações) | 0 | 0 | 0 |
| Foco no "Cancelar pedido" durante a leitura | mantido | mantido | mantido |

Observação sem severidade: o `aria-describedby="vaFrase"` do Pedir só existe quando o painel nasce em "Tudo"; ao alternar pelo seletor ele não é posto. O botão desabilitado não recebe foco e a frase está visível logo acima, então não bloqueia.

## Não verifiquei
Leitor de tela real (a leitura do anúncio vem do DOM), Opera, aparelho real.

## Acordo
Sem acordo ainda, por C3 (uma linha). Corrigido e medido (largura da `i` = largura da barra com movimento reduzido), dou "pronto para o dono" sem nova rodada.
