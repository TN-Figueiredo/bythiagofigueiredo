# Brand Guide · Thiago Figueiredo Studio

> Sistema de marca pessoal · v6 · regras invioláveis  
> Última atualização: maio 2026

---

## 1. Identidade

**Nome canônico:** Thiago Figueiredo Studio  
**Mark gráfico:** Carimbo TF (selo editorial circular)  
**Mark tipográfico:** Fleuron `tf ❦ Thiago Figueiredo` (texto inline)

---

## 2. TF · uso do monograma

### TF (uppercase) · MARK GRÁFICO

**Sempre maiúsculo.** Aparece em:
- Carimbo (todas as variantes)
- Favicon (.ico, .png)
- Profile picture (YouTube, LinkedIn, Twitter, GitHub)
- Avatar de produtos derivados
- OG image
- Watermark (PDF, slides)

**Regra:** sempre que for SÍMBOLO.

### tf (lowercase italic) · TEXTO EDITORIAL

**Sempre minúsculo, italic, inline.** Aparece em:
- Assinatura no rodapé de email (`tf ❦ Thiago Figueiredo`)
- End-mark de artigo (após o último parágrafo, antes do bio)
- Footnote signature
- Verso de cartão de visita

**Regra:** sempre que for TEXTO em fluxo.

### Nunca

- ❌ **Nunca** uppercase TF no fluxo editorial.
- ❌ **Nunca** lowercase tf como mark gráfico standalone.

---

## 3. Cor

### Paleta

| Token | Light | Dark |
|---|---|---|
| Ink | `#1F1B17` | `#F5EFE6` |
| Background | `#F7F1E8` | `#1A1714` |
| Card | `#FBF6EC` | `#221E1A` |
| Accent (laranja) | `#FF8240` | `#FF8240` |
| Accent deep | `#E0651E` | `#E0651E` |

### Regra de saturação

Laranja `#FF8240` em **≤10%** da área de pixel total de qualquer tela. Quando aparece, anuncia. Mais que isso vira poluição visual e o ink perde peso.

### Regra de herança

- **Ink/stroke** pode usar `currentColor` (herda do CSS pai)
- **Laranja** SEMPRE hex fixo. Nunca `currentColor`. Brand color não pode virar monochrome.

### Onde laranja aparece (9 superfícies)

1. Dot do carimbo (Full + Simplified)
2. Ring do Mark e ring da foto
3. Fleuron `❦` glifo
4. Links inline em texto corrido
5. CTAs primários (background)
6. Badges "novo" / hover (background)
7. Underline de current page na nav
8. Drop cap (primeira letra de artigos)
9. `caret-color`, `outline` (focus ring), `::selection`, reading progress bar, border-left de pull quotes

---

## 4. Tipografia

### Stack oficial

| Função | Fonte | Uso |
|---|---|---|
| Display / Mark | **Fraunces** | Carimbo TF, headlines, drop caps |
| Body | **Source Serif 4** | Parágrafos, texto longo |
| UI / Wordmark utility | **Inter** | Texto orbital em sizes <96px, labels micro |
| Mono | **JetBrains Mono** | Código, labels técnicos, captions |

### Orbital · size-driven font choice

> O texto orbital `THIAGO FIGUEIREDO · STUDIO` usa fonte diferente conforme o tamanho do carimbo.

- **Carimbo ≥96px** → Fraunces caps (serifa lê, coerência tipográfica importa)
- **Carimbo <96px** → Inter (Fraunces caps em pixel pequeno fica ilegível)

Decisão técnica de legibilidade, não inconsistência.

### TF outlined · variante slab

Existem **dois pares válidos** do TF:

1. **TF Fraunces** (canon) — `<text>` com font-family Fraunces, usa quando a fonte está disponível (web, app, deck)
2. **TF Slab Outlined** (variante intencional) — `<path>` geométrico simplificado, usa em contextos micro/font-less (favicon `.ico`, email signature, embed terceiro, watermark de PDF antigo)

> A versão Slab **não é fallback temporário** — é par válido com identidade própria. Se quiser fidelity Fraunces real em paths (preservando serifas e stress), exportar via FontForge a partir do glyph original quando necessário.

---

## 5. Texto orbital · 2 strings disponíveis

Mesma marca, duas strings conforme contexto:

### Canon (default)
```
THIAGO FIGUEIREDO · STUDIO ·
```
Pra: business card, OG image, portfolio, watermark, contextos heritage/editoriais.

### Formal / minimal
```
THIAGO FIGUEIREDO ·
```
Pra: GitHub, fóruns dev, contextos peer-to-peer onde "Studio" pode soar pretensioso.

A escolha não muda a marca — só a string. Mantém flexibilidade sem comprometer canon.

---

## 6. Carimbo · hierarquia por tamanho

| Variante | Tamanho | Composição |
|---|---|---|
| Full | ≥96px | Ring duplo + texto orbital + TF central + dot |
| Simplified | 48–96px | Ring duplo + TF + dot, sem orbital |
| Mark | 24–48px | Ring laranja simples + TF (sem ring interno) |
| Mini | 16–24px | Laranja sólido com TF creme |
| TF Only | qualquer | Apenas TF + dot, sem rings (pra contextos densos) |

Auto-seleção implementada via `<CarimboAuto size={n}/>`.

---

## 7. Carimbo + foto

Foto **substitui** o miolo do carimbo (não convive ao lado).

| Variante | Tamanho |
|---|---|
| Photo Full | ≥96px (texto orbital + foto cropada circular) |
| Photo Simplified | 32–96px (ring laranja + foto) |
| Photo Mark | <32px (foto + ring fino) |

### Slot técnico

- `<PortraitSlot href="/path/foto.jpg"/>` — slot real, aponta pra arquivo. Usar em produção.
- `<PortraitMock/>` — desenho stylized, claramente labeled mockup. Usar em wireframes/specs antes de ter foto real.

---

## 8. Export · 3 variantes

Mesmo design, **3 arquivos distintos**:

| Arquivo | Stroke / TF | Uso |
|---|---|---|
| `carimbo.svg` | `currentColor` | SVG inline em sites teus, herda do CSS pai |
| `carimbo-light.svg` | `#1F1B17` fixo | Pra `<img>` em fundos claros (CMS, Markdown, Notion) |
| `carimbo-dark.svg` | `#F5EFE6` fixo | Pra `<img>` em fundos escuros |

> **Por quê 3 versões?** `currentColor` só funciona em SVG inline ou `<object>`. Em `<img src>` (Markdown blog, CMS, email signature, Notion embed) o color do pai é ignorado — precisa hardcoded.
>
> Laranja **sempre** hex fixo, em todas as 3 variantes.

---

## 9. Fleuron · `tf ❦ Thiago Figueiredo`

Composição inline:
- `tf` — Fraunces 600 italic, ink atual
- `❦` — Source Serif, laranja `#FF8240`, optical translate +2px
- `Thiago Figueiredo` — Source Serif 400, ink @ 85% opacity

### End-mark (fim de artigo)

```
─── ❦ ───
```

Linha laranja @ 40% opacity + ❦ central + linha laranja @ 40% opacity.

---

## 10. Aplicação ao redor

### CTA primário
```css
background: #FF8240;
color: #1F1B17;
font-family: Fraunces;
```

### Focus + caret
```css
outline: 2px solid #FF8240;
outline-offset: 2px;
caret-color: #FF8240;
```

### Selection
```css
::selection { background: #FF8240; color: #1F1B17; }
```

### Drop cap
Primeira letra do artigo: Fraunces 600, 56px, `#FF8240`, float left, line-height 0.85, margin-right 8px.

### Reading progress bar
```css
height: 4px;
background: #FF8240;
position: fixed; top: 0;
```

### Pull quote
```css
border-left: 3px solid #FF8240;
padding-left: 14px;
font-family: Fraunces;
font-style: italic;
```

---

## 11. Checklist · antes de publicar qualquer asset

- [ ] TF é uppercase (gráfico) ou lowercase italic (texto inline)?
- [ ] Laranja em ≤10% da área?
- [ ] Stroke usa currentColor (inline) ou hex fixo (img)?
- [ ] Laranja é hex fixo?
- [ ] Fonte: Fraunces (display) / Source Serif (body) / Inter (UI utility) / JetBrains Mono?
- [ ] Orbital: Fraunces ≥96px, Inter <96px?
- [ ] Foto: PortraitSlot real ou Mock claramente labeled?
- [ ] String: STUDIO canon ou minimal sem-tagline?

---

*Brand Guide v6 · maio 2026 · `tf ❦ Thiago Figueiredo`*
