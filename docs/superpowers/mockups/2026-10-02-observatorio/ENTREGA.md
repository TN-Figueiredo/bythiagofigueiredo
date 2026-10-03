# Observatório de Competidores — mockups para aprovação (02/10/2026)

Mockups HTML (não é código de produção). Dados fictícios coerentes, gerados por `dados.js` (agora = sáb 24/10/2026 15:02 SP).

## Como abrir
```
cd docs/superpowers/mockups/2026-10-02-observatorio && python3 -m http.server 8800
```
Abra http://localhost:8800/canais.html (abas levam às outras telas). A barra "Estados do mockup" no rodapé simula estados da forja, sincronização e casos de borda.

| Tela | Arquivo | Última nota independente |
|---|---|---|
| Canais | canais.html | 93 (F11) → fixes aplicados |
| Mudanças (antes/depois de título, thumb, descrição + efeito) | mudancas.html | 92 → fixes aplicados |
| Outliers (janelas 0–30 / 31–90 / 91–180 / 181–365 / >1 ano) | outliers.html | 93 → fixes aplicados |
| Insights (leitura da forja) | insights.html | 90 → fixes aplicados |
| Histórico por vídeo (todas as versões de título/thumb/descrição) | historico-video.html | 91 → fixes aplicados |
| Moldura + fluxo de pedido à forja | moldura-forja.html | 92 → fixes aplicados |
| Conjunto (coerência entre telas) | — | 92 (F11) → fixes aplicados |

A rodada F12 (fechamento) foi interrompida no início por orçamento: as notas acima são as últimas medidas; os fixes posteriores foram verificados só pelas auditorias dos próprios autores.

## O que responde aos pedidos originais
- "Testar esta abordagem"/"Abrir no Cowork"/"Montar roteiro" saíram; a forja é o centro (pedido por nicho/tipo, fila honesta, estados do Health Coach).
- Antes → depois e histórico completo por vídeo (títulos, thumbnails A/B/C, descrições com diff), efeito observado vs esperado pela idade, com n e faixa.
- Detecção de thumbnail sem falso "0 mudanças" (exige ETag/fingerprint — ver PEDIDOS-API.md); descrição guardada como texto, não só hash.
- Outliers com janelas de tempo; idade e multiplicador coerentes.
- Limite de canais 50 (o seu canal não ocupa vaga); bug "-1 vagas" corrigido no desenho.

## Decisões registradas
`CONVENCOES.md` (todas as regras por rodada), `BRIEF.md` (inclui requisito "mais canais" e gargalos reais: cron serial de 300 s, cota da Data API, orçamento da forja).

## Pendente (não feito)
1. Sua aprovação visual destes mockups.
2. Spec em `docs/superpowers/specs/` e depois o plano (writing-plans) — só após aprovação.
3. Confirmar o número de canais (provisório: 50).
4. Itens da auditoria inicial (segurança S1–S6, CI, forja F1–F7) aguardam sua priorização.
