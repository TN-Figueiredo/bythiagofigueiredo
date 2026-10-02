NOTA F8: 85/100 (dados 22, util 18, hier 14, sist 9, texto 8, a11y 7, téc 7)
B1 #confirm/#addDlg dentro de #screen ficam atrás do drawer modal (<1280) e inertes → mover para body, z-index acima do backdrop, sem inert.
B2 pedido do drawer substitui o cenário inteiro e apaga o pedido do outro nicho → compor por nicho (mapa {viagem,ia}), trocar só o do nicho.
I1 toast fim da rodada: título "11 canais sincronizados agora; 3 com problema", corpo com problemPhrase intacta (sem replace de parênteses).
I2 usar defaultSync do chrome + onSynced (render + reabrir drawer).
I3 .toolbar/.syncbar sem margin-top.
I4 foco após syncOne → [data-retry] ou .nmbtn.
I5 Esq: "sem média: sincronização com erro desde…" em vez da regra dos 7 dias.
M1 "Seu pedido das 14:58: … pedido 14:58" repetido. M2 motivo em falhou/recusado com Todos. M3 "Sincronizado agora" sem vírgula. M4 animação da rodada sem progresso inventado. M5 nicho único → requestScenario(s,{niche}). M6 problemPhrase só no stat. M7 (discutível) restaurar nicho ao fechar drawer — NÃO fazer (F4). M8 texto do toast de cópia. M9 NBSP "13 sem".
