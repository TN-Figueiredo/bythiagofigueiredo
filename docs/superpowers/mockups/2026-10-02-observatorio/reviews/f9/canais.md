NOTA F9: 87/100 (dados 21, util 18, hier 13, sist 9, texto 9, a11y 8, téc 9)
B1 limite 15 (l.334-335, 569, 622) contra decisão do dono (50) → OBS.RULES.channelLimit = 50 (só concorrentes; o seu não conta); tela só lê de OBS; free = Math.max(0,…).
B2 Todos no drawer: listar R.statusLines + R.statusText visível; tirar "Pedido de X: <linha>" (l.725-726).
I1 remover/adicionar fabricam sucesso (l.671, 636) → simular de fato ou "(demonstração: nada foi removido)".
I2 foco ao fechar Add/Confirm com drawer modal → #dClose.
I3 célula da tabela e stat do drawer com problemPhrase inteira (l.519-520, 748).
I4 linha extra do drawer não repete o chip.
M1 texto do toast de cópia. M2 404: "Atualizar handle…"/"Remover canal…" primário. M3 mock open:<canal> com persist:false. M4 drawer em coluna: esconder Outliers/trazer Trocas.
Conjunto: C4 (= I3); C5 effect.noBaseText; C7 effect.readyText.
