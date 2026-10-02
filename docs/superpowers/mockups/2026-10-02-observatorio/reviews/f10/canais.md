NOTA F10: 88/100 (dados 23, util 18, hier 13, sist 9, texto 8, a11y 10, téc 7)
B1 cabeçalho ignora a sessão na carga (headerForja não roda após render inicial, l.859-863) → chamar no fim de render() ou após a carga.
I1 falhou: failReason duplicado (l.735-736) → com R.statusText não acrescentar reason.
I2 "Atualizar handle…" primary (l.523) → contornado.
I3 onNiche não atualiza drawer (l.836) → forjaState(st.sel) ou fechar se fora do filtro.
I4 tabela cortada a 1440 com drawer → esconder thumb do outlier e small do Ritmo / min-width menor.
I5 "Seu pedido foi enviado agora" persiste após reload → st.justAsked em memória.
M1 404 repetido na .msg. M2 (MOTOR) ask().reason sem sufixo "(atrás do de X)". M3 (CHROME) contagem da rodada exclui buscando. M5 (HISTÓRICO) crumb "Canais" sem back.
