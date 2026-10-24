# F3b Adiar 7 dias: correções da rodada 2 (23/10/2026)

- **Logan B1:** legendas de `adiada`, `lista-com-adiadas`, `vazio-adiado` e `ctx-ablab-adiadas` reescritas sem falar do selo (textos do `logan-revisao-2.md`).
- **Logan B2:** `let timer` virou `const T={}` com um temporizador por linha em `recolhe(id)`; `setup()` limpa todos (`Object.values(T).forEach(clearTimeout)`). O foco só vai para a próxima linha se estava dentro da linha que some.
- **Naksu N6:** separador do estado "vence antes" ganhou a classe `sg-sep-v`; regra `.sg-dsp .sg-sep.sg-sep-v{display:none}` depois do bloco `@container (max-width:700px)` (esconde o `‖` em todas as larguras).
- **LEIAME.md:** a nota avulsa sobre reabrir o painel após o erro foi movida para dentro do item 8.
- **Conferido (Playwright headless):** (a) varredura do contêiner de 560 a 1100 px, passo 1, em `adiar-aberto` e `adiar-vence-antes`: 0 `‖` órfão; (b) 3 linhas respondidas em menos de 5 s (lista e A/B Lab): após 5,3 s nenhuma faixa resta e aparece o vazio; (c) os 14 estados a 1440 e 390: 0 erros de página.
