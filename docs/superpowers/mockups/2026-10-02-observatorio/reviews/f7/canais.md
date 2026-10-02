NOTA F7: 87/100 (dados 21, util 18, hier 14, sist 9, texto 9, a11y 8, téc 8)
B1 Todos: cabeçalho e drawer divergem; publicado mostra terminal com Viagem trabalhando. → R = requestScenario(s,{type:'resumo-trocas',niche:'todos'}) uma vez; cabeçalho = CHROME.forjaFromScenario(R) sem sobrescrever; drawer lê R.requests.find(q=>q.niche===c.niche). (= conjunto D1)
I1 seu canal vira "agora" após runSync (MOTOR: runSync exclui canal próprio).
I2 "Tentar de novo" → mesma função do syncone (runSync).
I3 cópia Cowork na linha falha → toast bad com {selectable: txt}.
I4 texto Cowork com canais.html → rota /cms/youtube/competitors?channel=… e padrão youtube_observatory.
I5 rótulos de sync do motor (c.sync.label); drawer "erro desde 22/10 00:00 · últimos dados 21/10 18:00".
I6 views de canal atrasado/erro com ", até 22/10 12:00" nos swapcards.
M1 título vs thumb na mesma janela: frases separadas. M2 desabilitar sync de canal em backfill. M3 toast da rodada: título curto, lista no corpo, sem parênteses aninhados. M4 rodapé do drawer em 1 linha. M5 HIST recalculado no clique; sem theme no back. M6 suprimir toast de nicho ao voltar do Histórico. M7 toasts forja kind 'forja'. M8 links via CHROME.link, leitura sem niche. M9 c.backfill morto. M10 considerar esconder Crescimento/Sincronização com drawer aberto.
Conjunto D6: não exibir "(n = 0)" do método descartado (motor corrige fallbackText; tela não concatena).
