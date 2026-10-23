# Logan, revisão 3 (F3b Adiar), 23/10/2026
**Nota: 96. Pronto para o dono: SIM.**

- B1 resolvido: as legendas de lista-com-adiadas, vazio-adiado, adiada e ctx-ablab-adiadas (linhas 416, 424, 425, 430) não citam mais o selo. O `.sg-selo` que resta é o da linha que voltou (estado `voltou`), que existe de propósito.
- B2 resolvido: `const T={}` com um temporizador por linha, `setup()` limpa todos, foco só se move quando estava dentro da linha que some. Medido com t.js: 3 respostas seguidas, 5,3 s depois 0 linhas e 0 faixas, e aparece o vazio ("Nenhuma sugestão aberta" na lista; "Sugestões 0" no A/B Lab). O único `role=status` que resta é o próprio vazio. 0 erros de página.
- Não reaberto: nenhum outro ponto.
- Não verificado: leitor de tela, aparelho real.
