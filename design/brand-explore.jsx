/**
 * Sistema de marca pessoal · v6 (BRAND LAW v2)
 *
 * Mudanças desde v5:
 *   - TFGlyphPath → TFGlyphSlab (nome força clareza: variante intencional)
 *   - Brand Law: declara Slab como par válido, não fallback
 *   - Orbital size-driven: Fraunces ≥96px, Inter <96px
 *   - 2 ORBITAL strings: canon (com STUDIO) e formal/minimal
 *   - Nova variante: CarimboTFOnly (sem rings, só TF + dot)
 *   - PortraitSlot (com <image href>) separado de PortraitMock (mockup labeled)
 *   - BRAND_GUIDE.md exportável
 */

const ACCENT = "#FF8240";
const ACCENT_DEEP = "#E0651E";
const INK_LIGHT = "#1F1B17";
const INK_DARK = "#F5EFE6";
const BG_LIGHT = "#F7F1E8";
const BG_DARK = "#1A1714";
const CARD_LIGHT = "#FBF6EC";
const CARD_DARK = "#221E1A";
const LINE_LIGHT = "rgba(31,27,23,0.14)";
const LINE_DARK = "rgba(245,239,230,0.16)";
const MUTED_LIGHT = "rgba(31,27,23,0.55)";
const MUTED_DARK = "rgba(245,239,230,0.55)";

// Strings orbitais — 2 disponíveis no sistema
const ORBITAL_CANON = "THIAGO FIGUEIREDO · STUDIO · THIAGO FIGUEIREDO · STUDIO · ";
const ORBITAL_MINIMAL = "THIAGO FIGUEIREDO · THIAGO FIGUEIREDO · THIAGO FIGUEIREDO · ";

const FRAUNCES = '"Fraunces", "Source Serif 4", Georgia, serif';
const INTER = '"Inter", "Helvetica Neue", system-ui, sans-serif';

// Size threshold pra orbital font (≥96 = Fraunces, <96 = Inter)
const ORBITAL_FRAUNCES_THRESHOLD = 96;

// ════════════════════════════════════════════════════════════════════
// CARIMBO · 5 variantes hierárquicas (4 + TF only)
// ════════════════════════════════════════════════════════════════════

const CarimboFull = ({ ink, accent = ACCENT, size = 144, orbital = ORBITAL_CANON }) => {
  const id = `cf-${size}-${Math.random().toString(36).slice(2,6)}`;
  // size-driven font choice: Fraunces ≥96, Inter <96
  const orbitalFont = size >= ORBITAL_FRAUNCES_THRESHOLD ? FRAUNCES : INTER;
  const orbitalSize = size >= ORBITAL_FRAUNCES_THRESHOLD ? 7 : 6.5;
  const orbitalLetterSpacing = size >= ORBITAL_FRAUNCES_THRESHOLD ? 2.4 : 3;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <path id={id} d="M 48,48 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none"/>
      </defs>
      <circle cx="48" cy="48" r="44" fill="none" stroke={ink} strokeWidth="1.2"/>
      <circle cx="48" cy="48" r="30" fill="none" stroke={ink} strokeWidth="0.8" opacity="0.5"/>
      <text fontFamily={orbitalFont} fontSize={orbitalSize} fontWeight="600"
            letterSpacing={orbitalLetterSpacing} fill={ink} opacity="0.85">
        <textPath href={`#${id}`} startOffset="0">{orbital}</textPath>
      </text>
      <text x="48" y="56" textAnchor="middle"
            fontFamily={FRAUNCES} fontSize="32" fontWeight="600"
            fill={ink} letterSpacing="-0.04em">TF</text>
      <circle cx="48" cy="80" r="2" fill={accent}/>
    </svg>
  );
};

const CarimboSimplified = ({ ink, accent = ACCENT, size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="none" stroke={ink} strokeWidth="1.4"/>
    <circle cx="32" cy="32" r="24" fill="none" stroke={ink} strokeWidth="0.7" opacity="0.45"/>
    <text x="32" y="38" textAnchor="middle"
          fontFamily={FRAUNCES} fontSize="22" fontWeight="600"
          fill={ink} letterSpacing="-0.04em">TF</text>
    <circle cx="32" cy="54" r="1.6" fill={accent}/>
  </svg>
);

// Mark · 24–48px · ring laranja sólido, SEM ring interno
const CarimboMark = ({ ink, accent = ACCENT, size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="14.5" fill="none" stroke={accent} strokeWidth="1.6"/>
    <text x="16" y="20" textAnchor="middle"
          fontFamily={FRAUNCES} fontSize="13" fontWeight="600"
          fill={ink} letterSpacing="-0.04em">TF</text>
  </svg>
);

const CarimboMini = ({ accent = ACCENT, fill = INK_DARK, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="7.5" fill={accent}/>
    <text x="8" y="11" textAnchor="middle"
          fontFamily={FRAUNCES} fontSize="8" fontWeight="600"
          fill={fill} letterSpacing="-0.04em">TF</text>
  </svg>
);

// NOVO · TF Only · sem rings, só TF + dot · pra contextos densos
const CarimboTFOnly = ({ ink, accent = ACCENT, size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <text x="16" y="20" textAnchor="middle"
          fontFamily={FRAUNCES} fontSize="18" fontWeight="600"
          fill={ink} letterSpacing="-0.04em">TF</text>
    <circle cx="16" cy="28" r="1.4" fill={accent}/>
  </svg>
);

const CarimboAuto = ({ ink, accent = ACCENT, size = 64 }) => {
  if (size >= 96) return <CarimboFull ink={ink} accent={accent} size={size}/>;
  if (size >= 48) return <CarimboSimplified ink={ink} accent={accent} size={size}/>;
  if (size >= 24) return <CarimboMark ink={ink} accent={accent} size={size}/>;
  return <CarimboMini accent={accent} fill={INK_DARK} size={size}/>;
};

// ════════════════════════════════════════════════════════════════════
// TF SLAB OUTLINED · variante intencional, par válido
//
// Glifo TF como paths SVG geométricos · slab simplificado.
// NÃO É Fraunces convertido — é desenho deliberado pra contextos
// font-less (favicon .ico, embed terceiro). Lê melhor que serif fino
// converted em pixel-art.
//
// Pra fidelity Fraunces real, exportar via FontForge a partir do
// glyph original quando necessário (TODO produção).
// ════════════════════════════════════════════════════════════════════

const TFGlyphSlab = ({ x = 16, y = 16, scale = 1, fill }) => (
  <g transform={`translate(${x} ${y}) scale(${scale})`}>
    {/* T · barra horizontal e haste vertical */}
    <path d="M -11.5,-7 L -2.5,-7 L -2.5,-5.2 L -6.2,-5.2 L -6.2,7 L -7.8,7 L -7.8,-5.2 L -11.5,-5.2 Z" fill={fill}/>
    {/* F · haste vertical, barra superior, barra do meio */}
    <path d="M -1.0,-7 L 7.5,-7 L 7.5,-5.2 L 0.6,-5.2 L 0.6,-1.0 L 5.8,-1.0 L 5.8,0.7 L 0.6,0.7 L 0.6,7 L -1.0,7 Z" fill={fill}/>
  </g>
);

const CarimboMiniSlab = ({ accent = ACCENT, fill = INK_DARK, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="7.5" fill={accent}/>
    <TFGlyphSlab x={8} y={8} scale={0.32} fill={fill}/>
  </svg>
);

const CarimboMarkSlab = ({ ink, accent = ACCENT, size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="14.5" fill="none" stroke={accent} strokeWidth="1.6"/>
    <TFGlyphSlab x={16} y={16} scale={0.55} fill={ink}/>
  </svg>
);

const CarimboFullSlab = ({ ink, accent = ACCENT, size = 144, orbital = ORBITAL_CANON }) => {
  const id = `cfs-${size}-${Math.random().toString(36).slice(2,6)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <path id={id} d="M 48,48 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none"/>
      </defs>
      <circle cx="48" cy="48" r="44" fill="none" stroke={ink} strokeWidth="1.2"/>
      <circle cx="48" cy="48" r="30" fill="none" stroke={ink} strokeWidth="0.8" opacity="0.5"/>
      {/* orbital ainda em <text> · a variante slab elimina dependência de font no TF central, não no orbital */}
      <text fontFamily={INTER} fontSize="6.5" fontWeight="600"
            letterSpacing="3" fill={ink} opacity="0.85">
        <textPath href={`#${id}`} startOffset="0">{orbital}</textPath>
      </text>
      <TFGlyphSlab x={48} y={50} scale={1.45} fill={ink}/>
      <circle cx="48" cy="80" r="2" fill={accent}/>
    </svg>
  );
};

// ════════════════════════════════════════════════════════════════════
// PORTRAIT · slot real vs mockup labeled
// ════════════════════════════════════════════════════════════════════

// PortraitSlot · usar em produção. Aponta pra arquivo de foto real.
const PortraitSlot = ({ size, cx, cy, href }) => (
  <image
    x={cx - size/2} y={cy - size/2}
    width={size} height={size}
    href={href}
    preserveAspectRatio="xMidYMid slice"
  />
);

// PortraitMock · desenho stylized · CLARAMENTE LABELED MOCKUP
// Usar em wireframes/specs antes de ter foto real.
const PortraitMock = ({ size, ink, cx, cy, scale = 1 }) => {
  const s = size * scale;
  return (
    <g>
      <circle cx={cx} cy={cy} r={s/2} fill={ink === INK_DARK ? "#3A332A" : "#EFE6D5"}/>
      <ellipse cx={cx} cy={cy - s * 0.05} rx={s * 0.20} ry={s * 0.23}
               fill="none" stroke={ink} strokeWidth="1.4" opacity="0.7"/>
      <path d={`M ${cx - s * 0.18} ${cy - s * 0.18}
                Q ${cx - s * 0.10} ${cy - s * 0.30}, ${cx} ${cy - s * 0.26}
                Q ${cx + s * 0.10} ${cy - s * 0.32}, ${cx + s * 0.20} ${cy - s * 0.16}`}
            fill="none" stroke={ink} strokeWidth="1.4" opacity="0.75"/>
      <circle cx={cx - s * 0.07} cy={cy - s * 0.02} r={s * 0.05}
              fill="none" stroke={ink} strokeWidth="1.1" opacity="0.6"/>
      <circle cx={cx + s * 0.07} cy={cy - s * 0.02} r={s * 0.05}
              fill="none" stroke={ink} strokeWidth="1.1" opacity="0.6"/>
      <line x1={cx - s * 0.02} y1={cy - s * 0.02} x2={cx + s * 0.02} y2={cy - s * 0.02}
            stroke={ink} strokeWidth="1.1" opacity="0.6"/>
      <path d={`M ${cx - s * 0.34} ${cy + s * 0.5}
                C ${cx - s * 0.34} ${cy + s * 0.20},
                  ${cx - s * 0.18} ${cy + s * 0.16},
                  ${cx} ${cy + s * 0.16}
                C ${cx + s * 0.18} ${cy + s * 0.16},
                  ${cx + s * 0.34} ${cy + s * 0.20},
                  ${cx + s * 0.34} ${cy + s * 0.5}`}
            fill="none" stroke={ink} strokeWidth="1.4" opacity="0.7"/>
    </g>
  );
};

// CARIMBO + FOTO · aceita slot real OU mock
const CarimboPhotoFull = ({ ink, accent = ACCENT, size = 144, photoHref, orbital = ORBITAL_CANON }) => {
  const id = `cpf-${size}-${Math.random().toString(36).slice(2,6)}`;
  const cid = `cpfc-${size}-${Math.random().toString(36).slice(2,6)}`;
  const orbitalFont = size >= ORBITAL_FRAUNCES_THRESHOLD ? FRAUNCES : INTER;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <path id={id} d="M 48,48 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none"/>
        <clipPath id={cid}><circle cx="48" cy="48" r="28"/></clipPath>
      </defs>
      <circle cx="48" cy="48" r="44" fill="none" stroke={ink} strokeWidth="1.2"/>
      <circle cx="48" cy="48" r="30" fill="none" stroke={accent} strokeWidth="1.4"/>
      <text fontFamily={orbitalFont} fontSize="6.8" fontWeight="600"
            letterSpacing={size >= ORBITAL_FRAUNCES_THRESHOLD ? 2.5 : 3}
            fill={ink} opacity="0.85">
        <textPath href={`#${id}`} startOffset="0">{orbital}</textPath>
      </text>
      <g clipPath={`url(#${cid})`}>
        {photoHref
          ? <PortraitSlot size={56} cx={48} cy={48} href={photoHref}/>
          : <PortraitMock size={56} ink={ink} cx={48} cy={48}/>
        }
      </g>
    </svg>
  );
};

const CarimboPhotoSimplified = ({ ink, accent = ACCENT, size = 64, photoHref }) => {
  const id = `cps-${size}-${Math.random().toString(36).slice(2,6)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs><clipPath id={id}><circle cx="32" cy="32" r="28"/></clipPath></defs>
      <circle cx="32" cy="32" r="30" fill="none" stroke={accent} strokeWidth="2"/>
      <g clipPath={`url(#${id})`}>
        {photoHref
          ? <PortraitSlot size={56} cx={32} cy={32} href={photoHref}/>
          : <PortraitMock size={56} ink={ink} cx={32} cy={32}/>
        }
      </g>
    </svg>
  );
};

const CarimboPhotoMark = ({ ink, accent = ACCENT, size = 32, photoHref }) => {
  const id = `cpm-${size}-${Math.random().toString(36).slice(2,6)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs><clipPath id={id}><circle cx="16" cy="16" r="15"/></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        {photoHref
          ? <PortraitSlot size={32} cx={16} cy={16} href={photoHref}/>
          : <PortraitMock size={32} ink={ink} cx={16} cy={16}/>
        }
      </g>
      <circle cx="16" cy="16" r="15" fill="none" stroke={accent} strokeWidth="1.4"/>
    </svg>
  );
};

const CarimboPhotoAuto = ({ ink, accent = ACCENT, size = 64, photoHref }) => {
  if (size >= 96) return <CarimboPhotoFull ink={ink} accent={accent} size={size} photoHref={photoHref}/>;
  if (size >= 32) return <CarimboPhotoSimplified ink={ink} accent={accent} size={size} photoHref={photoHref}/>;
  return <CarimboPhotoMark ink={ink} accent={accent} size={size} photoHref={photoHref}/>;
};

// ════════════════════════════════════════════════════════════════════
// FLEURON inline (lowercase tf · sempre)
// ════════════════════════════════════════════════════════════════════

const FleuronInline = ({ ink, accent = ACCENT, size = 18 }) => (
  <span style={{ display: "inline-flex", alignItems: "baseline", gap: size * 0.36, lineHeight: 1 }}>
    <span style={{
      fontFamily: FRAUNCES, fontWeight: 600, fontStyle: "italic",
      fontSize: size, color: ink, letterSpacing: "-0.03em",
    }}>tf</span>
    <span style={{
      fontFamily: '"Source Serif 4", serif', fontSize: size * 0.85,
      color: accent, lineHeight: 1, transform: "translateY(2px)",
      display: "inline-block",
    }}>❦</span>
    <span style={{
      fontFamily: '"Source Serif 4", serif', fontWeight: 400,
      fontSize: size * 0.92, color: ink, opacity: 0.85,
    }}>Thiago Figueiredo</span>
  </span>
);

const FleuronEndmark = ({ accent = ACCENT, size = 24 }) => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: size * 0.4 }}>
    <span style={{ height: 1, width: size * 1.5, background: accent, opacity: 0.4, display: "inline-block" }}/>
    <span style={{
      fontFamily: '"Source Serif 4", serif', fontSize: size, color: accent, lineHeight: 1,
    }}>❦</span>
    <span style={{ height: 1, width: size * 1.5, background: accent, opacity: 0.4, display: "inline-block" }}/>
  </div>
);

// ════════════════════════════════════════════════════════════════════
// PRESENTATION HELPERS
// ════════════════════════════════════════════════════════════════════

const Label = ({ children, muted, size = 10.5 }) => (
  <div style={{
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontSize: size, letterSpacing: "0.08em", textTransform: "uppercase",
    color: muted, fontWeight: 500,
  }}>{children}</div>
);

const Caption = ({ children, muted, style = {} }) => (
  <div style={{
    fontFamily: '"Source Serif 4", Georgia, serif',
    fontSize: 12, lineHeight: 1.55, color: muted, fontStyle: "italic", ...style,
  }}>{children}</div>
);

const Panel = ({ title, role, line, muted, card, children }) => (
  <div style={{
    padding: "26px 24px", background: card, border: `1px solid ${line}`, borderRadius: 6,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <Label muted={muted}>{title}</Label>
      <Label muted={muted} size={9.5}>{role}</Label>
    </div>
    <div style={{ marginTop: 22 }}>{children}</div>
  </div>
);

const Rule = ({ ink, muted, accent, label, body }) => (
  <div style={{ paddingLeft: 14, borderLeft: `2px solid ${accent}`, marginBottom: 16 }}>
    <Label muted={muted} size={10}>{label}</Label>
    <div style={{
      fontFamily: '"Source Serif 4", Georgia, serif',
      fontSize: 14, lineHeight: 1.55, color: ink, marginTop: 4,
    }}>{body}</div>
  </div>
);

const Code = ({ children, ink }) => (
  <code style={{
    background: "rgba(31,27,23,0.06)", padding: "1px 6px", borderRadius: 3,
    fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: ink,
  }}>{children}</code>
);

// ════════════════════════════════════════════════════════════════════
// PAINEL 00 · BRAND LAW · regras invioláveis
// ════════════════════════════════════════════════════════════════════

const BrandLawPanel = ({ ink, line, muted, card, accent }) => (
  <Panel title="00 · brand law" role="regras invioláveis · não negociáveis" line={line} muted={muted} card={card}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
      <div>
        <Label muted={muted} size={10}>uso de TF · mark gráfico</Label>
        <div style={{
          marginTop: 12, padding: 14, background: "rgba(255,130,64,0.08)",
          borderRadius: 4, display: "flex", alignItems: "center", gap: 14,
        }}>
          <CarimboMark ink={ink} accent={accent} size={40}/>
          <div style={{
            fontFamily: FRAUNCES, fontSize: 26, fontWeight: 600,
            color: ink, letterSpacing: "-0.04em",
          }}>TF</div>
        </div>
        <div style={{
          fontFamily: '"Source Serif 4", serif', fontSize: 13, lineHeight: 1.55,
          color: ink, marginTop: 12, opacity: 0.85,
        }}>
          <strong>Maiúsculo, sempre.</strong> Carimbo, favicon, profile pic,
          OG image, watermark.
          <br/><em style={{ color: muted }}>Sempre que for SÍMBOLO.</em>
        </div>
      </div>

      <div>
        <Label muted={muted} size={10}>uso de tf · texto editorial</Label>
        <div style={{
          marginTop: 12, padding: 14, background: "rgba(255,130,64,0.08)",
          borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <FleuronInline ink={ink} accent={accent} size={16}/>
        </div>
        <div style={{
          fontFamily: '"Source Serif 4", serif', fontSize: 13, lineHeight: 1.55,
          color: ink, marginTop: 12, opacity: 0.85,
        }}>
          <strong>Minúsculo, italic, inline.</strong> Email signature, end-mark
          de artigo, footnote signature.
          <br/><em style={{ color: muted }}>Sempre que for TEXTO em fluxo.</em>
        </div>
      </div>
    </div>

    <div style={{
      margin: "24px 0", padding: "14px 16px", background: "rgba(31,27,23,0.04)",
      borderRadius: 4, borderLeft: `3px solid ${accent}`,
    }}>
      <Label muted={muted} size={10}>nunca</Label>
      <div style={{
        fontFamily: '"Source Serif 4", serif', fontSize: 13, lineHeight: 1.65,
        color: ink, marginTop: 6,
      }}>
        Nunca uppercase TF no fluxo editorial. Nunca lowercase tf como mark gráfico standalone.
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 8 }}>
      <Rule
        ink={ink} muted={muted} accent={accent}
        label="cor · saturação"
        body={<>Laranja <Code ink={ink}>#FF8240</Code> em ≤<strong>10%</strong> da área de pixel total. Quando aparece, anuncia.</>}
      />
      <Rule
        ink={ink} muted={muted} accent={accent}
        label="cor · herança"
        body={<>Ink/stroke pode ser <Code ink={ink}>currentColor</Code>. Laranja <strong>nunca</strong> herda — sempre hex fixo.</>}
      />
      <Rule
        ink={ink} muted={muted} accent={accent}
        label="export · 3 variantes"
        body={<>Mesmo design em <strong>3 arquivos</strong>: <Code ink={ink}>currentColor</Code> / hardcoded light / hardcoded dark.</>}
      />
      <Rule
        ink={ink} muted={muted} accent={accent}
        label="orbital · size-driven font"
        body={<><strong>Fraunces ≥96px</strong>, <strong>Inter &lt;96px</strong>. Decisão técnica de legibilidade, não inconsistência.</>}
      />
      <Rule
        ink={ink} muted={muted} accent={accent}
        label="TF outlined · par válido"
        body={<>Carimbo Fraunces é <strong>canon</strong>. <strong>TF Slab</strong> é variante intencional pra contextos micro/font-less. Não é fallback temporário — é par válido.</>}
      />
      <Rule
        ink={ink} muted={muted} accent={accent}
        label="orbital · 2 strings"
        body={<><strong>Canon:</strong> <Code ink={ink}>· STUDIO</Code>. <strong>Minimal:</strong> só nome. Mesma marca, escolha por contexto.</>}
      />
    </div>
  </Panel>
);

// ════════════════════════════════════════════════════════════════════
// PAINEL · ORBITAL SIZE-DRIVEN
// ════════════════════════════════════════════════════════════════════

const OrbitalFontPanel = ({ ink, line, muted, card, accent }) => (
  <Panel title="03 · orbital · size-driven font choice" role="Fraunces ≥96px · Inter <96px" line={line} muted={muted} card={card}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <Label muted={muted} size={10}>≥96px · Fraunces caps</Label>
        <div style={{ display: "flex", gap: 22, alignItems: "flex-end", marginTop: 14 }}>
          <CarimboFull ink={ink} accent={accent} size={144}/>
          <CarimboFull ink={ink} accent={accent} size={120}/>
          <CarimboFull ink={ink} accent={accent} size={96}/>
        </div>
        <Caption muted={muted} style={{ marginTop: 12 }}>
          Coerência tipográfica importa. Serifa lê. Usa em business card, OG image, portfolio.
        </Caption>
      </div>
      <div>
        <Label muted={muted} size={10}>&lt;96px · Inter</Label>
        <div style={{ display: "flex", gap: 22, alignItems: "flex-end", marginTop: 14 }}>
          <CarimboFull ink={ink} accent={accent} size={88}/>
          <CarimboFull ink={ink} accent={accent} size={72}/>
          <CarimboFull ink={ink} accent={accent} size={56}/>
        </div>
        <Caption muted={muted} style={{ marginTop: 12 }}>
          Fraunces caps em pixel pequeno fica ilegível. Inter é wordmark utility do brand.
        </Caption>
      </div>
    </div>
  </Panel>
);

// ════════════════════════════════════════════════════════════════════
// PAINEL · 2 ORBITAL STRINGS
// ════════════════════════════════════════════════════════════════════

const OrbitalStringsPanel = ({ ink, line, muted, card, accent }) => (
  <Panel title="04 · orbital · 2 strings disponíveis" role="canon STUDIO · formal/minimal" line={line} muted={muted} card={card}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <Label muted={muted} size={10}>canon · com STUDIO</Label>
        <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
          <CarimboFull ink={ink} accent={accent} size={144} orbital={ORBITAL_CANON}/>
        </div>
        <div style={{
          padding: "8px 12px", background: "rgba(31,27,23,0.04)", borderRadius: 4,
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: ink,
          letterSpacing: "0.04em", textAlign: "center",
        }}>THIAGO FIGUEIREDO · STUDIO ·</div>
        <Caption muted={muted} style={{ marginTop: 10 }}>
          Default. Pra business card, OG image, portfolio, watermark, contextos editoriais.
        </Caption>
      </div>
      <div>
        <Label muted={muted} size={10}>formal · só nome</Label>
        <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}>
          <CarimboFull ink={ink} accent={accent} size={144} orbital={ORBITAL_MINIMAL}/>
        </div>
        <div style={{
          padding: "8px 12px", background: "rgba(31,27,23,0.04)", borderRadius: 4,
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: ink,
          letterSpacing: "0.04em", textAlign: "center",
        }}>THIAGO FIGUEIREDO ·</div>
        <Caption muted={muted} style={{ marginTop: 10 }}>
          Pra GitHub, fóruns dev, contextos peer-to-peer onde "Studio" pode soar pretensioso.
        </Caption>
      </div>
    </div>
  </Panel>
);

// ════════════════════════════════════════════════════════════════════
// PAINEL · 3 VARIANTES DE EXPORT
// ════════════════════════════════════════════════════════════════════

const ExportVariantsPanel = ({ ink, line, muted, card, accent }) => (
  <Panel title="05 · export · 3 variantes" role="currentColor · light · dark" line={line} muted={muted} card={card}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
      <div style={{
        padding: 24, background: "linear-gradient(135deg, #F7F1E8 50%, #1A1714 50%)",
        borderRadius: 4, position: "relative", minHeight: 200,
      }}>
        <div style={{
          position: "absolute", top: 12, left: 12, fontFamily: 'monospace',
          fontSize: 9, color: INK_LIGHT, letterSpacing: "0.08em", textTransform: "uppercase",
        }}>currentColor</div>
        <div style={{
          position: "absolute", bottom: 12, right: 12, fontFamily: 'monospace',
          fontSize: 9, color: INK_DARK, letterSpacing: "0.08em", textTransform: "uppercase",
        }}>herda CSS</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center", alignItems: "center", padding: "32px 0" }}>
          <div style={{ color: INK_LIGHT }}><CarimboSimplified ink="currentColor" accent={accent} size={64}/></div>
          <div style={{ color: INK_DARK }}><CarimboSimplified ink="currentColor" accent={accent} size={64}/></div>
        </div>
      </div>

      <div style={{ padding: 24, background: BG_LIGHT, borderRadius: 4, position: "relative", minHeight: 200 }}>
        <div style={{
          position: "absolute", top: 12, left: 12, fontFamily: 'monospace',
          fontSize: 9, color: INK_LIGHT, letterSpacing: "0.08em", textTransform: "uppercase",
        }}>carimbo-light.svg</div>
        <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
          <CarimboSimplified ink={INK_LIGHT} accent={accent} size={88}/>
        </div>
        <Caption muted={MUTED_LIGHT} style={{ textAlign: "center", marginTop: 4 }}>
          ink #1F1B17 fixo · pra fundos claros
        </Caption>
      </div>

      <div style={{ padding: 24, background: BG_DARK, borderRadius: 4, position: "relative", minHeight: 200 }}>
        <div style={{
          position: "absolute", top: 12, left: 12, fontFamily: 'monospace',
          fontSize: 9, color: INK_DARK, letterSpacing: "0.08em", textTransform: "uppercase",
        }}>carimbo-dark.svg</div>
        <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
          <CarimboSimplified ink={INK_DARK} accent={accent} size={88}/>
        </div>
        <Caption muted={MUTED_DARK} style={{ textAlign: "center", marginTop: 4 }}>
          ink #F5EFE6 fixo · pra fundos escuros
        </Caption>
      </div>
    </div>
    <div style={{
      marginTop: 16, padding: "12px 14px", background: "rgba(255,130,64,0.06)", borderRadius: 4,
      fontFamily: '"Source Serif 4", serif', fontSize: 13, color: ink, lineHeight: 1.5,
    }}>
      <strong>Por quê 3 versões?</strong> <Code ink={ink}>currentColor</Code> só funciona em SVG inline ou <Code ink={ink}>&lt;object&gt;</Code>. Em <Code ink={ink}>&lt;img src&gt;</Code> (Markdown, CMS, email, Notion embed) o color do pai é ignorado — precisa hardcoded.
    </div>
  </Panel>
);

// ════════════════════════════════════════════════════════════════════
// PAINEL · TF SLAB OUTLINED · par válido
// ════════════════════════════════════════════════════════════════════

const SlabPanel = ({ ink, line, muted, card, accent }) => (
  <Panel title="06 · TF slab outlined · par válido" role="variante intencional · contextos micro/font-less" line={line} muted={muted} card={card}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <Label muted={muted} size={10}>canon · TF Fraunces</Label>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-end", marginTop: 14 }}>
          <CarimboFull ink={ink} accent={accent} size={120}/>
          <CarimboMark ink={ink} accent={accent} size={48}/>
          <CarimboMini accent={accent} size={32}/>
        </div>
        <Caption muted={muted} style={{ marginTop: 12 }}>
          Web, app, deck — onde Fraunces está carregada via CSS. Fonte completa, serifa, optical sizing.
        </Caption>
      </div>
      <div>
        <Label muted={muted} size={10}>variante · TF Slab Outlined</Label>
        <div style={{ display: "flex", gap: 24, alignItems: "flex-end", marginTop: 14 }}>
          <CarimboFullSlab ink={ink} accent={accent} size={120}/>
          <CarimboMarkSlab ink={ink} accent={accent} size={48}/>
          <CarimboMiniSlab accent={accent} size={32}/>
        </div>
        <Caption muted={muted} style={{ marginTop: 12 }}>
          Favicon .ico, email signature, watermark de PDF, embed terceiro. Slab geométrico simplificado.
        </Caption>
      </div>
    </div>
    <div style={{
      marginTop: 16, padding: "12px 14px", background: "rgba(255,130,64,0.06)", borderRadius: 4,
      fontFamily: '"Source Serif 4", serif', fontSize: 13, color: ink, lineHeight: 1.55,
    }}>
      <strong>Importante:</strong> TF Slab <strong>não é fallback temporário</strong> — é par válido com identidade própria. Slab geométrico lê melhor em 16px do que serif fino converted em pixel-art (a serifa fina vira aliasing fantasma em low-res). Pra fidelity Fraunces real, exportar via FontForge a partir do glyph original quando necessário.
    </div>
  </Panel>
);

// ════════════════════════════════════════════════════════════════════
// PAINEL · TF ONLY (sem rings)
// ════════════════════════════════════════════════════════════════════

const TFOnlyPanel = ({ ink, line, muted, card, accent }) => (
  <Panel title="07 · TF only · sem rings" role="contextos densos · UI compacta · watermark sobre imagem" line={line} muted={muted} card={card}>
    <div style={{ display: "flex", gap: 36, alignItems: "flex-end" }}>
      {[24, 32, 48, 72, 96].map((s) => (
        <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <CarimboTFOnly ink={ink} accent={accent} size={s}/>
          <Label muted={muted} size={9.5}>{s}px</Label>
        </div>
      ))}
    </div>
    <Caption muted={muted} style={{ marginTop: 16 }}>
      Quinta variante. Pra contextos onde os rings brigam com layout — UI muito densa, badge minúsculo, watermark sobre imagem com competição visual. TF + dot apenas.
    </Caption>
  </Panel>
);

// ════════════════════════════════════════════════════════════════════
// PAINEL · PORTRAIT · slot vs mock
// ════════════════════════════════════════════════════════════════════

const PortraitPanel = ({ ink, line, muted, card, accent }) => (
  <Panel title="08 · portrait · slot real vs mock labeled" role="produção vs wireframe" line={line} muted={muted} card={card}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Label muted={muted} size={10}>PortraitSlot · produção</Label>
          <span style={{
            padding: "2px 8px", borderRadius: 99, fontSize: 9, fontFamily: 'monospace',
            background: "rgba(34,180,80,0.15)", color: "#1a8a3a", letterSpacing: "0.05em",
          }}>real</span>
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-end", marginTop: 14 }}>
          <CarimboPhotoFull ink={ink} accent={accent} size={120} photoHref="photo-placeholder.svg"/>
          <CarimboPhotoSimplified ink={ink} accent={accent} size={64} photoHref="photo-placeholder.svg"/>
          <CarimboPhotoMark ink={ink} accent={accent} size={32} photoHref="photo-placeholder.svg"/>
        </div>
        <div style={{
          marginTop: 12, padding: "8px 10px", background: "rgba(31,27,23,0.04)",
          borderRadius: 4, fontFamily: 'monospace', fontSize: 10, color: ink,
          letterSpacing: "0.03em",
        }}>
          {`<CarimboPhotoFull photoHref="/me.jpg"/>`}
        </div>
        <Caption muted={muted} style={{ marginTop: 8 }}>
          Slot real com <Code ink={ink}>&lt;image href&gt;</Code>. Trocar atributo por arquivo de foto real em produção.
        </Caption>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Label muted={muted} size={10}>PortraitMock · wireframe</Label>
          <span style={{
            padding: "2px 8px", borderRadius: 99, fontSize: 9, fontFamily: 'monospace',
            background: "rgba(255,130,64,0.18)", color: ACCENT_DEEP, letterSpacing: "0.05em",
          }}>mockup</span>
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "flex-end", marginTop: 14 }}>
          <CarimboPhotoFull ink={ink} accent={accent} size={120}/>
          <CarimboPhotoSimplified ink={ink} accent={accent} size={64}/>
          <CarimboPhotoMark ink={ink} accent={accent} size={32}/>
        </div>
        <div style={{
          marginTop: 12, padding: "8px 10px", background: "rgba(31,27,23,0.04)",
          borderRadius: 4, fontFamily: 'monospace', fontSize: 10, color: ink,
          letterSpacing: "0.03em",
        }}>
          {`<CarimboPhotoFull/>  // sem photoHref → mock`}
        </div>
        <Caption muted={muted} style={{ marginTop: 8 }}>
          Desenho stylized. Usar em wireframes/specs antes de ter foto real. Não usar em produção.
        </Caption>
      </div>
    </div>
  </Panel>
);

// ════════════════════════════════════════════════════════════════════
// PAINEL · HIERARQUIA POR TAMANHO
// ════════════════════════════════════════════════════════════════════

const HierarchyPanel = ({ ink, line, muted, card, accent }) => (
  <Panel title="01 · carimbo · 4 níveis hierárquicos + TF Only" role="auto-seleção por tamanho" line={line} muted={muted} card={card}>
    <div style={{ display: "flex", gap: 36, alignItems: "flex-end" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <CarimboFull ink={ink} accent={accent} size={144}/>
        <Label muted={muted} size={9.5}>Full · ≥96px</Label>
        <Caption muted={muted}>orbital + duplo ring</Caption>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <CarimboSimplified ink={ink} accent={accent} size={88}/>
        <Label muted={muted} size={9.5}>Simplified · 48–96</Label>
        <Caption muted={muted}>duplo ring + dot</Caption>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <CarimboMark ink={ink} accent={accent} size={48}/>
        <Label muted={muted} size={9.5}>Mark · 24–48</Label>
        <Caption muted={muted}>ring laranja simples</Caption>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <CarimboMini accent={accent} size={32}/>
        <Label muted={muted} size={9.5}>Mini · 16–24</Label>
        <Caption muted={muted}>laranja sólido</Caption>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <CarimboTFOnly ink={ink} accent={accent} size={48}/>
        <Label muted={muted} size={9.5}>TF Only · qualquer</Label>
        <Caption muted={muted}>sem rings · denso</Caption>
      </div>
    </div>
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${line}` }}>
      <Label muted={muted} size={9.5}>Auto · seleção por tamanho</Label>
      <div style={{ display: "flex", gap: 28, alignItems: "flex-end", marginTop: 14 }}>
        {[16, 24, 32, 48, 64, 96, 144].map((s) => (
          <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <CarimboAuto ink={ink} accent={accent} size={s}/>
            <Label muted={muted} size={9.5}>{s}</Label>
          </div>
        ))}
      </div>
    </div>
  </Panel>
);

const PhotoPanel = ({ ink, line, muted, card, accent }) => (
  <Panel title="02 · carimbo + foto · 3 níveis" role="foto substitui o miolo" line={line} muted={muted} card={card}>
    <div style={{ display: "flex", gap: 36, alignItems: "flex-end" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <CarimboPhotoFull ink={ink} accent={accent} size={144}/>
        <Label muted={muted} size={9.5}>Full · ≥96px</Label>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <CarimboPhotoSimplified ink={ink} accent={accent} size={88}/>
        <Label muted={muted} size={9.5}>Simplified · 32–96</Label>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <CarimboPhotoMark ink={ink} accent={accent} size={48}/>
        <Label muted={muted} size={9.5}>Mark · &lt;32</Label>
      </div>
    </div>
    <Caption muted={muted} style={{ marginTop: 16 }}>
      Variante <strong>mock</strong> mostrada acima. Pra slot real com foto, ver painel 08.
    </Caption>
  </Panel>
);

const FleuronPanel = ({ ink, line, muted, card, accent }) => (
  <Panel title="09 · fleuron · texto inline (lowercase tf)" role="signature · footer · end-mark" line={line} muted={muted} card={card}>
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {[14, 18, 22].map((s) => (
        <div key={s}>
          <Label muted={muted} size={9.5}>{s}px</Label>
          <div style={{ marginTop: 8 }}>
            <FleuronInline ink={ink} accent={accent} size={s}/>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 8, paddingTop: 18, borderTop: `1px solid ${line}` }}>
        <Label muted={muted} size={9.5}>End-mark (fim de artigo)</Label>
        <div style={{ marginTop: 14 }}>
          <FleuronEndmark accent={accent} size={22}/>
        </div>
      </div>
    </div>
  </Panel>
);

// ════════════════════════════════════════════════════════════════════
// PAINEL · APLICAÇÃO DO LARANJA EM UI
// ════════════════════════════════════════════════════════════════════

const OrangeApplicationPanel = ({ ink, line, muted, card, accent, light }) => {
  const surface = light ? "#fff" : "#0F0D0B";
  return (
    <Panel title="10 · laranja em UI · 9 superfícies" role="≤10% da área · pontual, anuncia" line={line} muted={muted} card={card}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ padding: 18, background: surface, border: `1px solid ${line}`, borderRadius: 4 }}>
          <Label muted={muted} size={9.5}>link inline · texto corrido</Label>
          <div style={{
            fontFamily: '"Source Serif 4", serif', fontSize: 14, lineHeight: 1.6,
            color: ink, marginTop: 10,
          }}>
            Pra rodar Postgres em produção,{' '}
            <span style={{
              color: accent, textDecoration: "underline",
              textDecorationThickness: 1, textUnderlineOffset: 3,
            }}>siga este guia de tuning</span>
            {' '}— o default não serve pra workload de leitura.
          </div>
        </div>

        <div style={{ padding: 18, background: surface, border: `1px solid ${line}`, borderRadius: 4 }}>
          <Label muted={muted} size={9.5}>CTA primário</Label>
          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
            <button style={{
              padding: "10px 18px", background: accent, color: INK_LIGHT,
              border: "none", borderRadius: 4, fontFamily: FRAUNCES, fontSize: 14, fontWeight: 600,
              cursor: "pointer", letterSpacing: "-0.01em",
            }}>Assinar newsletter</button>
            <button style={{
              padding: "10px 18px", background: "transparent", color: ink,
              border: `1px solid ${line}`, borderRadius: 4, fontFamily: FRAUNCES, fontSize: 14,
              cursor: "pointer", letterSpacing: "-0.01em",
            }}>Ver depois</button>
          </div>
        </div>

        <div style={{ padding: 18, background: surface, border: `1px solid ${line}`, borderRadius: 4 }}>
          <Label muted={muted} size={9.5}>badges · tags</Label>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {["artigo", "8 min", "infra", "novo"].map((b, i) => (
              <span key={b} style={{
                padding: "3px 10px", borderRadius: 99, fontSize: 11,
                fontFamily: FRAUNCES, letterSpacing: "0.02em",
                background: i === 3 ? accent : "transparent",
                color: i === 3 ? INK_LIGHT : ink,
                border: i === 3 ? "none" : `1px solid ${line}`,
                fontWeight: i === 3 ? 600 : 400,
              }}>{b}</span>
            ))}
          </div>
        </div>

        <div style={{ padding: 18, background: surface, border: `1px solid ${line}`, borderRadius: 4 }}>
          <Label muted={muted} size={9.5}>nav · página atual</Label>
          <div style={{
            display: "flex", gap: 22, marginTop: 12, fontFamily: '"Source Serif 4", serif',
            fontSize: 14, color: ink,
          }}>
            <span>Posts</span>
            <span style={{
              borderBottom: `2px solid ${accent}`, paddingBottom: 2, color: ink, fontWeight: 500,
            }}>Vídeos</span>
            <span style={{ opacity: 0.7 }}>Newsletter</span>
            <span style={{ opacity: 0.7 }}>Sobre</span>
          </div>
        </div>

        <div style={{ padding: 18, background: surface, border: `1px solid ${line}`, borderRadius: 4 }}>
          <Label muted={muted} size={9.5}>drop cap · primeira letra</Label>
          <div style={{
            fontFamily: '"Source Serif 4", serif', fontSize: 13, lineHeight: 1.55,
            color: ink, marginTop: 10,
          }}>
            <span style={{
              float: "left", fontFamily: FRAUNCES, fontSize: 56, fontWeight: 600,
              color: accent, lineHeight: 0.85, marginRight: 8, marginTop: 4,
              letterSpacing: "-0.04em",
            }}>O</span>
            cold-start no Lambda é um problema mais subtle do que parece. Nos primeiros segundos, a função sobe, mas o runtime ainda está sendo inicializado.
          </div>
        </div>

        <div style={{ padding: 18, background: surface, border: `1px solid ${line}`, borderRadius: 4 }}>
          <Label muted={muted} size={9.5}>pull quote · border</Label>
          <blockquote style={{
            margin: "12px 0 0", paddingLeft: 14, borderLeft: `3px solid ${accent}`,
            fontFamily: FRAUNCES, fontSize: 16, fontStyle: "italic", lineHeight: 1.4,
            color: ink, letterSpacing: "-0.01em",
          }}>
            "Otimize a coisa errada e você está só rearranjando móveis no Titanic."
          </blockquote>
        </div>

        <div style={{ padding: 18, background: surface, border: `1px solid ${line}`, borderRadius: 4 }}>
          <Label muted={muted} size={9.5}>focus ring + caret</Label>
          <div style={{ marginTop: 12 }}>
            <input
              type="text" defaultValue="thiago@" placeholder="email"
              style={{
                width: "100%", padding: "10px 12px", background: "transparent",
                border: `1px solid ${line}`, borderRadius: 4, color: ink,
                fontFamily: FRAUNCES, fontSize: 14,
                outline: `2px solid ${accent}`, outlineOffset: 2,
                caretColor: accent,
              }}
            />
          </div>
          <div style={{
            display: "flex", gap: 10, marginTop: 8, alignItems: "center",
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: muted,
            letterSpacing: "0.04em",
          }}>
            <span>outline 2px</span><span>·</span><span>caret-color: {accent}</span>
          </div>
        </div>

        <div style={{ padding: 18, background: surface, border: `1px solid ${line}`, borderRadius: 4 }}>
          <Label muted={muted} size={9.5}>selection highlight</Label>
          <div style={{
            fontFamily: '"Source Serif 4", serif', fontSize: 13, lineHeight: 1.6,
            color: ink, marginTop: 10,
          }}>
            o <span style={{
              background: accent, color: INK_LIGHT, padding: "1px 2px",
            }}>cold-start no Lambda</span> é um problema mais subtle do que parece.
          </div>
          <div style={{
            marginTop: 8, fontFamily: 'monospace', fontSize: 10, color: muted,
            letterSpacing: "0.04em",
          }}>::selection {`{ background: ${accent} }`}</div>
        </div>

        <div style={{ padding: 18, background: surface, border: `1px solid ${line}`, borderRadius: 4 }}>
          <Label muted={muted} size={9.5}>reading progress bar</Label>
          <div style={{
            position: "relative", marginTop: 14, height: 4, background: line, borderRadius: 99,
            overflow: "hidden",
          }}>
            <div style={{ width: "37%", height: "100%", background: accent }}/>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", marginTop: 6,
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: muted,
            letterSpacing: "0.04em",
          }}>
            <span>3 min lidos</span><span>5 min restantes</span>
          </div>
        </div>
      </div>

      <div style={{
        marginTop: 16, padding: "12px 14px", background: "rgba(255,130,64,0.06)", borderRadius: 4,
      }}>
        <Label muted={muted} size={10}>regra de saturação</Label>
        <div style={{
          fontFamily: '"Source Serif 4", serif', fontSize: 13, lineHeight: 1.55,
          color: ink, marginTop: 6,
        }}>
          Conte os pixels laranja em qualquer tela acima: ≤<strong>10%</strong>. Quando passa disso vira poluição visual e o ink perde peso. Em design editorial bem feito, accent color é pontual — quando aparece, anuncia.
        </div>
      </div>
    </Panel>
  );
};

// ════════════════════════════════════════════════════════════════════
// APLICAÇÕES (mantidas)
// ════════════════════════════════════════════════════════════════════

const HeaderApp = ({ ink, accent, line, light }) => (
  <div style={{
    background: light ? "#ffffff" : "#0F0D0B",
    borderRadius: 6, border: `1px solid ${line}`, overflow: "hidden",
  }}>
    <div style={{
      padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
      color: light ? INK_LIGHT : INK_DARK,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <CarimboMark ink={light ? INK_LIGHT : INK_DARK} accent={accent} size={32}/>
        <span style={{
          fontFamily: '"Source Serif 4", serif', fontSize: 18, fontWeight: 500,
          color: light ? INK_LIGHT : INK_DARK, letterSpacing: "-0.02em",
        }}>Thiago Figueiredo</span>
        <span style={{
          fontFamily: '"Source Serif 4", serif', fontSize: 13, fontWeight: 400, fontStyle: "italic",
          color: light ? "rgba(31,27,23,0.55)" : "rgba(245,239,230,0.55)", marginLeft: 4,
        }}>· Studio</span>
      </div>
      <div style={{
        display: "flex", gap: 22, fontFamily: '"Source Serif 4", serif', fontSize: 14,
        color: light ? "rgba(31,27,23,0.75)" : "rgba(245,239,230,0.75)",
      }}>
        <span>Posts</span>
        <span style={{ borderBottom: `2px solid ${accent}`, paddingBottom: 2, color: light ? INK_LIGHT : INK_DARK }}>Vídeos</span>
        <span>Newsletter</span><span>Sobre</span>
      </div>
    </div>
  </div>
);

const PostCardApp = ({ ink, accent, line, muted, card, withPhoto = true }) => (
  <div style={{
    background: card, padding: 20, border: `1px solid ${line}`, borderRadius: 6,
    display: "flex", gap: 16, alignItems: "flex-start",
  }}>
    {withPhoto
      ? <CarimboPhotoSimplified ink={ink} accent={accent} size={48}/>
      : <CarimboMark ink={ink} accent={accent} size={48}/>
    }
    <div style={{ flex: 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Label muted={muted} size={10}>artigo</Label>
        <span style={{
          padding: "2px 8px", borderRadius: 99, fontSize: 10, fontFamily: FRAUNCES,
          background: accent, color: INK_LIGHT, fontWeight: 600, letterSpacing: "0.02em",
        }}>novo</span>
      </div>
      <div style={{
        fontFamily: '"Source Serif 4", serif', fontSize: 18, fontWeight: 500,
        color: ink, lineHeight: 1.3, marginTop: 6, letterSpacing: "-0.015em",
      }}>Como reduzir cold-start no Lambda em 80%</div>
      <div style={{
        fontFamily: '"Source Serif 4", serif', fontSize: 13, lineHeight: 1.5, color: muted, marginTop: 8,
      }}>Otimizando bundle size, runtime e memory allocation pra ter funções serverless rápidas.</div>
    </div>
  </div>
);

const OGImageApp = ({ accent }) => (
  <div style={{
    width: "100%", aspectRatio: "1200/630", background: BG_DARK,
    borderRadius: 6, position: "relative", overflow: "hidden",
    color: INK_DARK, display: "flex", flexDirection: "column", justifyContent: "space-between",
    padding: 28,
  }}>
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.06 }}>
      <defs>
        <pattern id="og-hatch" width="6" height="6" patternUnits="userSpaceOnUse">
          <line x1="0" y1="6" x2="6" y2="0" stroke={INK_DARK} strokeWidth="0.6"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#og-hatch)"/>
    </svg>
    <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12 }}>
      <CarimboMark ink={INK_DARK} accent={accent} size={28}/>
      <span style={{
        fontFamily: '"Source Serif 4", serif', fontSize: 14, fontWeight: 500, letterSpacing: "-0.01em",
      }}>Thiago Figueiredo · Studio</span>
    </div>
    <div style={{ position: "relative", zIndex: 1 }}>
      <Label muted={MUTED_DARK} size={9}>artigo · 8 min · maio 2026</Label>
      <div style={{
        fontFamily: '"Source Serif 4", serif', fontSize: 30, fontWeight: 500,
        color: INK_DARK, lineHeight: 1.12, marginTop: 6,
        letterSpacing: "-0.025em", maxWidth: "78%",
      }}>Como reduzir cold-start no Lambda em 80%</div>
    </div>
    <div style={{ position: "absolute", right: 24, bottom: 20, zIndex: 1 }}>
      <CarimboPhotoFull ink={INK_DARK} accent={accent} size={88}/>
    </div>
  </div>
);

const EmailSignatureApp = ({ ink, accent, line, card }) => (
  <div style={{
    background: card, padding: 22, border: `1px solid ${line}`, borderRadius: 6,
    fontFamily: '"Source Serif 4", serif', color: ink,
  }}>
    <div style={{ fontSize: 14, lineHeight: 1.6 }}>Abraço,<br/>Thiago</div>
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${line}` }}>
      <FleuronInline ink={ink} accent={accent} size={15}/>
      <div style={{
        marginTop: 8, fontSize: 12, color: ink, opacity: 0.6,
        fontFamily: '"Inter", sans-serif', letterSpacing: "0.03em",
      }}>thiago@bythiagofigueiredo.com  ·  bythiagofigueiredo.com</div>
    </div>
  </div>
);

const BlogEndmarkApp = ({ ink, accent, line, card, muted }) => (
  <div style={{
    background: card, padding: "32px 28px", border: `1px solid ${line}`, borderRadius: 6,
    fontFamily: '"Source Serif 4", serif', color: ink,
  }}>
    <p style={{ fontSize: 15, lineHeight: 1.65, margin: 0, opacity: 0.85 }}>
      …e foi assim que reduzimos o cold-start de 1.8s pra 380ms. Vale o esforço? Em alta escala, sempre.
    </p>
    <div style={{ margin: "28px 0" }}>
      <FleuronEndmark accent={accent} size={20}/>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <CarimboPhotoSimplified ink={ink} accent={accent} size={56}/>
      <div>
        <div style={{ fontSize: 14, fontWeight: 500, letterSpacing: "-0.015em" }}>Thiago Figueiredo</div>
        <Caption muted={muted} style={{ marginTop: 2 }}>Engenheiro · escreve sobre infra, IA e ofício.</Caption>
      </div>
    </div>
  </div>
);

const BusinessCardApp = ({ ink, accent, line }) => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
    <div style={{
      aspectRatio: "1.75/1", background: BG_LIGHT, color: INK_LIGHT,
      borderRadius: 4, border: `1px solid ${line}`, padding: 22,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      fontFamily: '"Source Serif 4", serif', position: "relative",
    }}>
      <Label muted={MUTED_LIGHT} size={9}>frente</Label>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
        <CarimboFull ink={INK_LIGHT} accent={accent} size={120}/>
      </div>
    </div>
    <div style={{
      aspectRatio: "1.75/1", background: BG_LIGHT, color: INK_LIGHT,
      borderRadius: 4, border: `1px solid ${line}`, padding: 22,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
      fontFamily: '"Source Serif 4", serif',
    }}>
      <Label muted={MUTED_LIGHT} size={9}>verso</Label>
      <div>
        <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.025em", lineHeight: 1.1 }}>
          Thiago Figueiredo
        </div>
        <div style={{
          fontSize: 12, fontStyle: "italic", color: MUTED_LIGHT, marginTop: 4,
        }}>Engenheiro · escritor · ofício</div>
      </div>
      <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{
          fontFamily: '"Inter", sans-serif', fontSize: 10, letterSpacing: "0.06em",
          color: INK_LIGHT, opacity: 0.7, lineHeight: 1.6,
        }}>
          thiago@bythiagofigueiredo.com<br/>
          bythiagofigueiredo.com
        </div>
        <FleuronInline ink={INK_LIGHT} accent={accent} size={11}/>
      </div>
    </div>
  </div>
);

// ════════════════════════════════════════════════════════════════════
// CANVAS
// ════════════════════════════════════════════════════════════════════

const FullSheet = ({ theme }) => {
  const light = theme === "light";
  const ink = light ? INK_LIGHT : INK_DARK;
  const bg = light ? BG_LIGHT : BG_DARK;
  const card = light ? CARD_LIGHT : CARD_DARK;
  const line = light ? LINE_LIGHT : LINE_DARK;
  const muted = light ? MUTED_LIGHT : MUTED_DARK;

  return (
    <div style={{
      width: 1000, padding: 36, background: bg, color: ink,
      fontFamily: '"Source Serif 4", Georgia, serif',
      display: "flex", flexDirection: "column", gap: 22,
    }}>
      <div style={{ paddingBottom: 18, borderBottom: `1px solid ${line}` }}>
        <Label muted={muted} size={10}>{theme} · v6 · brand law v2</Label>
        <div style={{ fontSize: 38, fontWeight: 500, marginTop: 6, letterSpacing: "-0.025em", lineHeight: 1, fontFamily: FRAUNCES }}>
          Carimbo + Fleuron
        </div>
        <div style={{
          fontSize: 14, lineHeight: 1.5, marginTop: 8, fontStyle: "italic", fontWeight: 300,
          color: ink, opacity: 0.75, maxWidth: 640,
        }}>
          5 variantes · 2 strings orbitais · TF Slab como par válido · Portrait slot real vs mock ·
          orbital size-driven · BRAND_GUIDE.md exportável.
        </div>
      </div>

      <BrandLawPanel ink={ink} line={line} muted={muted} card={card} accent={ACCENT}/>
      <HierarchyPanel ink={ink} line={line} muted={muted} card={card} accent={ACCENT}/>
      <PhotoPanel ink={ink} line={line} muted={muted} card={card} accent={ACCENT}/>
      <OrbitalFontPanel ink={ink} line={line} muted={muted} card={card} accent={ACCENT}/>
      <OrbitalStringsPanel ink={ink} line={line} muted={muted} card={card} accent={ACCENT}/>
      <ExportVariantsPanel ink={ink} line={line} muted={muted} card={card} accent={ACCENT}/>
      <SlabPanel ink={ink} line={line} muted={muted} card={card} accent={ACCENT}/>
      <TFOnlyPanel ink={ink} line={line} muted={muted} card={card} accent={ACCENT}/>
      <PortraitPanel ink={ink} line={line} muted={muted} card={card} accent={ACCENT}/>
      <FleuronPanel ink={ink} line={line} muted={muted} card={card} accent={ACCENT}/>
      <OrangeApplicationPanel ink={ink} line={line} muted={muted} card={card} accent={ACCENT} light={light}/>

      <Panel title="11 · header de site" role="navigation · com underline laranja em current" line={line} muted={muted} card={card}>
        <HeaderApp ink={ink} accent={ACCENT} line={line} light={light}/>
      </Panel>

      <Panel title="12 · card de post" role="listing · com badge 'novo' em laranja" line={line} muted={muted} card={card}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PostCardApp ink={ink} accent={ACCENT} line={line} muted={muted} card={light ? "#fff" : "#0F0D0B"} withPhoto={true}/>
          <PostCardApp ink={ink} accent={ACCENT} line={line} muted={muted} card={light ? "#fff" : "#0F0D0B"} withPhoto={false}/>
        </div>
      </Panel>

      <Panel title="13 · OG image · 1200×630" role="social share" line={line} muted={muted} card={card}>
        <OGImageApp accent={ACCENT}/>
      </Panel>

      <Panel title="14 · email signature" role="fleuron inline (lowercase tf)" line={line} muted={muted} card={card}>
        <EmailSignatureApp ink={ink} accent={ACCENT} line={line} card={light ? "#fff" : "#0F0D0B"}/>
      </Panel>

      <Panel title="15 · fim de artigo · author bio" role="fleuron end-mark + carimbo+foto" line={line} muted={muted} card={card}>
        <BlogEndmarkApp ink={ink} accent={ACCENT} line={line} card={light ? "#fff" : "#0F0D0B"} muted={muted}/>
      </Panel>

      <Panel title="16 · cartão de visita" role="frente carimbo · verso fleuron" line={line} muted={muted} card={card}>
        <BusinessCardApp ink={ink} accent={ACCENT} line={line}/>
      </Panel>

      <Panel title="17 · favicon · prova final em pixels reais" role="16 / 24 / 32 / 48" line={line} muted={muted} card={card}>
        <div style={{ display: "flex", gap: 40, alignItems: "flex-end" }}>
          <div>
            <Label muted={muted} size={9.5}>Carimbo · TF Fraunces</Label>
            <div style={{ display: "flex", gap: 22, marginTop: 14, alignItems: "flex-end" }}>
              {[16, 24, 32, 48].map((s) => (
                <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <CarimboAuto ink={ink} accent={ACCENT} size={s}/>
                  <Label muted={muted} size={9.5}>{s}</Label>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label muted={muted} size={9.5}>Carimbo · TF Slab</Label>
            <div style={{ display: "flex", gap: 22, marginTop: 14, alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <CarimboMiniSlab accent={ACCENT} size={16}/>
                <Label muted={muted} size={9.5}>16</Label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <CarimboMiniSlab accent={ACCENT} size={24}/>
                <Label muted={muted} size={9.5}>24</Label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <CarimboMarkSlab ink={ink} accent={ACCENT} size={32}/>
                <Label muted={muted} size={9.5}>32</Label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <CarimboMarkSlab ink={ink} accent={ACCENT} size={48}/>
                <Label muted={muted} size={9.5}>48</Label>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="18 · brand_guide.md" role="documento exportável · sobrevive ao código" line={line} muted={muted} card={card}>
        <div style={{
          padding: "16px 18px", background: light ? "#fff" : "#0F0D0B",
          border: `1px solid ${line}`, borderRadius: 4,
          fontFamily: '"JetBrains Mono", monospace', fontSize: 12, lineHeight: 1.7,
          color: ink,
        }}>
          <div style={{ color: muted, marginBottom: 10 }}># Brand Guide · Thiago Figueiredo Studio</div>
          <div>2. TF · uso do monograma</div>
          <div style={{ paddingLeft: 16, color: muted }}>2.1 TF (uppercase) · MARK GRÁFICO</div>
          <div style={{ paddingLeft: 16, color: muted }}>2.2 tf (lowercase italic) · TEXTO EDITORIAL</div>
          <div>3. Cor · paleta · saturação ≤10% · herança</div>
          <div>4. Tipografia · stack · orbital size-driven · TF Slab</div>
          <div>5. Texto orbital · 2 strings disponíveis</div>
          <div>6. Carimbo · 5 variantes hierárquicas</div>
          <div>7. Carimbo + foto · slot real vs mock</div>
          <div>8. Export · 3 variantes</div>
          <div>9. Fleuron · tf ❦ Thiago Figueiredo</div>
          <div>10. Aplicação ao redor · CSS snippets</div>
          <div>11. Checklist · antes de publicar</div>
        </div>
        <Caption muted={muted} style={{ marginTop: 12 }}>
          Documento markdown completo em <Code ink={ink}>BRAND_GUIDE.md</Code>. Sobrevive ao JSX. Pra time, handoff, futuro tu mesmo daqui a 6 meses.
        </Caption>
      </Panel>
    </div>
  );
};

function App() {
  return (
    <DesignCanvas
      title="Carimbo + Fleuron · v6 · brand law v2"
      subtitle="THIAGO FIGUEIREDO · STUDIO. 5 variantes · 2 strings orbitais · TF Slab par válido · Portrait slot/mock · orbital size-driven · brand_guide.md."
      bg="#EFE9DC"
    >
      <DCSection id="light" title="Light">
        <DCArtboard id="sheet-light" label="Sistema completo · light" width={1000} height={5400}>
          <FullSheet theme="light"/>
        </DCArtboard>
      </DCSection>
      <DCSection id="dark" title="Dark">
        <DCArtboard id="sheet-dark" label="Sistema completo · dark" width={1000} height={5400}>
          <FullSheet theme="dark"/>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
