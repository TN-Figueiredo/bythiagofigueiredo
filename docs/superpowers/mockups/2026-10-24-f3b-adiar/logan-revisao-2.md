# F3b Adiar 7 dias: revisão de fluxo, rodada 2 (Logan, 23/10/2026)

**Nota: 92/100. Aprova: NÃO** (2 achados "corrige", ambos pequenos; nenhum "bloqueia"). Playwright headless, 1440 e 390, sem erro de página, sem overflow (scrollWidth = largura). Capturas: `ux-revisao-shots/r2-*`.

## A1 a A4 e selo: conferidos
- **A1 resolvido.** Em "Adiando…" há 4 controles `disabled` (motivos, Já fiz e Cancelar; o botão Adiar fica aria-disabled) e clique forçado em Cancelar e em motivo é ignorado: painel segue aberto, resultado final único "Adiada. Volta ... sex, 30/10." (1440 e 390).
- **A2 resolvido.** Depois do erro "Não adiou: ela vence em 28/10", reabrir o painel mostra `[data-adiar]`=0 e a frase "Vence em qua, 28/10: não dá para adiar 7 dias." (`r2-a2-reaberto-*`).
- **A3 resolvido no caso de uma ação por vez.** Ao responder a última linha aberta, a faixa aparece, o vazio não é precoce, o foco cai em `H2#sum` (não mais no body), o bloco mostra "Nenhuma sugestão aberta." em vez de "0 sugestão: .".
- **A4 resolvido.** Página e bloco: "Adiadas por você: não medido. Não deu para contar quantas voltam nem quando." Não afirma mais que o dado.
- **Selo removido: sem perda de informação.** Contagem e data seguem na linha "2 adiadas por você. A próxima volta em ter, 27/10." (página e bloco) e no vazio ("Você adiou 2 sugestões. A próxima volta..."). Nada ficou só no selo. O cabeçalho a 390 ficou mais limpo.

## Achados novos

### B1. corrige. Legendas do próprio mockup ainda falam do selo
- **Tela/estado:** barra de legenda (`#expl`) de `lista-com-adiadas`, `vazio-adiado`, `adiada`, `ctx-ablab-adiadas` (index.html linhas 415, 423, 424, 429).
- **Defeito:** dizem "Selo '⏱ 2 adiadas' no cabeçalho", "o selo some", "N, resumo e selo", "bloco ... com selo", e o selo não existe mais. O dono lê a legenda para saber o que conferir e vai procurar um elemento que removemos.
- **Custo:** o dono acha que a tela quebrou ou que a decisão dele sobre o selo foi ignorada.
- **Correção (textos):**
  - 415: "... N e resumo já contam sem a linha adiada."
  - 423: "Linha sob o resumo: \"2 adiadas por você. A próxima volta em ter, 27/10.\" N continua 3. Não há selo no cabeçalho."
  - 424: "N = 0: o vazio fala (relógio, neutro). Título, data da próxima e a frase do motivo do cálculo."
  - 429: "Bloco no A/B Lab com resumo e a mesma linha de contagem."

### B2. corrige. Mockup: um único timer de recolhimento prende faixas
- **Tela/estado:** `ctx-ablab-adiadas` (e a página): dispensar/adiar 2 ou mais linhas em menos de 5 s (o gesto natural de "limpar a lista").
- **Defeito:** `recolhe(id)` usa um `timer` global e faz `clearTimeout(timer)`; a faixa da 1ª linha nunca recolhe. Medido: 3 linhas respondidas seguidas, 5,5 s depois ainda há 2 faixas ("Adiada" e "Dispensada") sob "Nenhuma sugestão aberta." e o vazio nunca aparece (`r2-a3-vazio-390.png`, `r2-a3-todas-respondidas-1440.png`). Em produção cada linha teria o seu temporizador; no mockup o dono verá um defeito que não existe.
- **Custo:** o dono reprova um comportamento que o código real não teria, ou não vê o vazio.
- **Correção:** `const T={};` no lugar de `let timer`; `recolhe(id){clearTimeout(T[id]);T[id]=setTimeout(()=>{const foco=focoProx(id);S.gone.add(id);render(foco)},5000)}`; em `setup()` e na troca de estado: `Object.values(T).forEach(clearTimeout)`. Foco: só mover para `focoProx` se `document.activeElement` estiver dentro da linha que some (senão o foco pula enquanto a pessoa age em outra).

## Não reaberto
Gatilho, três grupos, datas, texto único da contagem, "não medido" nunca zero, erro de rede com retry, ja_adiado.

## Para a Naksu
Nada novo; a faixa "Dispensada" (verde) ao lado da "Adiada" (neutra) fica bem distinta na captura.

## Não verificado
Leitor de tela real, rede lenta real, Opera, contraste no tema claro, N1 (fio a 700 px) por medida.
