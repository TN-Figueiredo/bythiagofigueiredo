# F3b Adiar: correções da rodada 1 (23/10/2026)

Aplicadas em `index.html` conforme `logan-revisao-1.md` e `naksu-revisao-1.md`:
- **A1** painel desabilitado em busy (motivos, Já fiz, Cancelar com `disabled`; guarda no listener; `.sg-lnk[disabled]`).
- **A2** `tentar()` no ramo corrida marca `stale:false`; reabrir o painel mostra a frase com ampulheta.
- **A3** `bloco()`: `vazio` considera faixas em andamento; `<h2 id="sum" tabindex="-1">`; CSS de foco; "Nenhuma sugestão aberta." quando não há abertas.
- **A4** vazio "não medido" (página e bloco) reescrito: "Adiadas por você: não medido. Não deu para contar quantas voltam nem quando."
- **N1** limiar do fio horizontal do painel subiu para 700 px (bloco próprio); `.sg-ven1` e `.sg-venm` ficam no de 640.
- **N2** `.sg p.sg-adl`, `.sg p.sg-blkmeta`, `.sg p.sg-venm` com margem de volta.
- **Decisões do controlador:** selo "N adiadas" removido (S1; `seloAdi()` apagada); ‖ e fios em `--btn-line` (N3).
- Não feitos: N4 (fora da lista), N5 (herdado da F3), S2 (opcional).

`LEIAME.md` ajustado nos itens 1, 2, 8 (nota), 9, 10, 11, 13 e nas novidades.

Verificação (Playwright headless, scripts no scratchpad): 14 estados carregam em 1440 e 390 sem erro de página; A1: 4 controles `disabled` durante Adiando, clique em Cancelar ignorado (painel segue aberto); A2: após o erro, `[data-adiar]`=0 e `.sg-vence`=1; A3: faixas 3, sem vazio precoce, foco em `#sum`, margem do blkmeta 4px. Não reconferido: capturas de contraste/tema claro, N1 a 700 px por medida.
