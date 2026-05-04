/**
 * Sistema de marca pessoal · v4 (FINAL DIRECTION)
 *
 * Decisão: Carimbo (primary) + Fleuron (typographic inline secondary).
 *
 * Texto orbital: "THIAGO FIGUEIREDO · STUDIO ·"
 * Foto lockup: foto cropada circular substitui o miolo, ring com texto
 * orbital ao redor preserva o selo. Smaller sizes simplificam.
 *
 * Hierarquia de tamanhos:
 *   ≥ 96px  : Carimbo Full (ring duplo + texto orbital + TF + dot)
 *   48–96px : Carimbo Simplified (ring duplo + TF + dot, sem orbital)
 *   24–48px : Carimbo Mark (ring laranja + TF)
 *   16–24px : Carimbo Mini (laranja sólido com TF branco)
 *
 * Foto:
 *   ≥ 96px  : foto circular + ring com texto orbital "THIAGO FIGUEIREDO · STUDIO"
 *   48–96px : foto + ring laranja simples (sem texto)
 *   < 48px  : foto sem ring (não força)
 *
 * Fleuron inline: "tf ❦ Thiago Figueiredo" pra signatures, footers,
 * end-marks, citações.
 */

const ACCENT = "#FF8240";
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

const ORBITAL = "THIAGO FIGUEIREDO · STUDIO · THIAGO FIGUEIREDO · STUDIO · ";

// ════════════════════════════════════════════════════════════════════
// CARIMBO — 4 tamanhos hierárquicos
// ════════════════════════════════════════════════════════════════════

const CarimboFull = ({ ink, accent, size = 144 }) => {
  const id = `cf-${size}-${Math.random().toString(36).slice(2,6)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <path id={id} d="M 48,48 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none"/>
      </defs>
      <circle cx="48" cy="48" r="44" fill="none" stroke={ink} strokeWidth="1.2"/>
      <circle cx="48" cy="48" r="30" fill="none" stroke={ink} strokeWidth="0.8" opacity="0.5"/>
      <text fontFamily='"Inter", sans-serif' fontSize="6.5" fontWeight="600"
            letterSpacing="3" fill={ink} opacity="0.85">
        <textPath href={`#${id}`} startOffset="0">{ORBITAL}</textPath>
      </text>
      <text x="48" y="56" textAnchor="middle"
            fontFamily='"Fraunces", serif' fontSize="32" fontWeight="600"
            fill={ink} letterSpacing="-0.04em">TF</text>
      <circle cx="48" cy="80" r="2" fill={accent}/>
    </svg>
  );
};

const CarimboSimplified = ({ ink, accent, size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="none" stroke={ink} strokeWidth="1.4"/>
    <circle cx="32" cy="32" r="24" fill="none" stroke={ink} strokeWidth="0.7" opacity="0.45"/>
    <text x="32" y="38" textAnchor="middle"
          fontFamily='"Fraunces", serif' fontSize="22" fontWeight="600"
          fill={ink} letterSpacing="-0.04em">TF</text>
    <circle cx="32" cy="54" r="1.6" fill={accent}/>
  </svg>
);

const CarimboMark = ({ ink, accent, size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="14.5" fill="none" stroke={accent} strokeWidth="1.6"/>
    <text x="16" y="20" textAnchor="middle"
          fontFamily='"Fraunces", serif' fontSize="13" fontWeight="600"
          fill={ink} letterSpacing="-0.04em">TF</text>
  </svg>
);

const CarimboMini = ({ ink, accent, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="7.5" fill={accent}/>
    <text x="8" y="11" textAnchor="middle"
          fontFamily='"Fraunces", serif' fontSize="8" fontWeight="600"
          fill={BG_LIGHT} letterSpacing="-0.04em">TF</text>
  </svg>
);

// CarimboAuto — seleciona variante por tamanho
const CarimboAuto = ({ ink, accent, size = 64 }) => {
  if (size >= 96) return <CarimboFull ink={ink} accent={accent} size={size}/>;
  if (size >= 48) return <CarimboSimplified ink={ink} accent={accent} size={size}/>;
  if (size >= 24) return <CarimboMark ink={ink} accent={accent} size={size}/>;
  return <CarimboMini ink={ink} accent={accent} size={size}/>;
};

// ════════════════════════════════════════════════════════════════════
// CARIMBO + FOTO — foto substitui o miolo
// ════════════════════════════════════════════════════════════════════

const PortraitFill = ({ size, ink, cx, cy, scale = 1 }) => {
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

const CarimboPhotoFull = ({ ink, accent, size = 144 }) => {
  const id = `cpf-${size}-${Math.random().toString(36).slice(2,6)}`;
  const cid = `cpfc-${size}-${Math.random().toString(36).slice(2,6)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <defs>
        <path id={id} d="M 48,48 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none"/>
        <clipPath id={cid}><circle cx="48" cy="48" r="28"/></clipPath>
      </defs>
      <circle cx="48" cy="48" r="44" fill="none" stroke={ink} strokeWidth="1.2"/>
      <circle cx="48" cy="48" r="30" fill="none" stroke={accent} strokeWidth="1.4"/>
      <text fontFamily='"Inter", sans-serif' fontSize="6.5" fontWeight="600"
            letterSpacing="3" fill={ink} opacity="0.85">
        <textPath href={`#${id}`} startOffset="0">{ORBITAL}</textPath>
      </text>
      <g clipPath={`url(#${cid})`}>
        <PortraitFill size={56} ink={ink} cx={48} cy={48}/>
      </g>
    </svg>
  );
};

const CarimboPhotoSimplified = ({ ink, accent, size = 64 }) => {
  const id = `cps-${size}-${Math.random().toString(36).slice(2,6)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs><clipPath id={id}><circle cx="32" cy="32" r="28"/></clipPath></defs>
      <circle cx="32" cy="32" r="30" fill="none" stroke={accent} strokeWidth="2"/>
      <g clipPath={`url(#${id})`}>
        <PortraitFill size={56} ink={ink} cx={32} cy={32}/>
      </g>
    </svg>
  );
};

const CarimboPhotoMark = ({ ink, accent, size = 32 }) => {
  const id = `cpm-${size}-${Math.random().toString(36).slice(2,6)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs><clipPath id={id}><circle cx="16" cy="16" r="15"/></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        <PortraitFill size={32} ink={ink} cx={16} cy={16}/>
      </g>
      <circle cx="16" cy="16" r="15" fill="none" stroke={accent} strokeWidth="1.4"/>
    </svg>
  );
};

const CarimboPhotoAuto = ({ ink, accent, size = 64 }) => {
  if (size >= 96) return <CarimboPhotoFull ink={ink} accent={accent} size={size}/>;
  if (size >= 32) return <CarimboPhotoSimplified ink={ink} accent={accent} size={size}/>;
  return <CarimboPhotoMark ink={ink} accent={accent} size={size}/>;
};

// ════════════════════════════════════════════════════════════════════
// FLEURON inline (typography secondary)
// ════════════════════════════════════════════════════════════════════

const FleuronInline = ({ ink, accent, size = 18 }) => (
  <span style={{ display: "inline-flex", alignItems: "baseline", gap: size * 0.36, lineHeight: 1 }}>
    <span style={{
      fontFamily: 'Fraunces, serif', fontWeight: 600, fontStyle: "italic",
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

const FleuronEndmark = ({ accent, size = 24 }) => (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: size * 0.4 }}>
    <span style={{ height: 1, width: size * 1.5, background: accent, opacity: 0.4, display: "inline-block" }}/>
    <span style={{
      fontFamily: '"Source Serif 4", serif', fontSize: size, color: accent, lineHeight: 1,
    }}>❦</span>
    <span style={{ height: 1, width: size * 1.5, background: accent, opacity: 0.4, display: "inline-block" }}/>
  </div>
);

// ════════════════════════════════════════════════════════════════════
// PRESENTATION
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

const SizeRow = ({ Comp, sizes, ink, accent, muted, labels }) => (
  <div style={{ display: "flex", gap: 32, alignItems: "flex-end", flexWrap: "wrap" }}>
    {sizes.map((s, i) => (
      <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <Comp ink={ink} accent={accent} size={s}/>
        <Label muted={muted} size={9.5}>{labels?.[i] ?? `${s}px`}</Label>
      </div>
    ))}
  </div>
);

// ════════════════════════════════════════════════════════════════════
// APLICAÇÕES REAIS
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
          color: light ? "rgba(31,27,23,0.55)" : "rgba(245,239,230,0.55)",
          marginLeft: 4,
        }}>· Studio</span>
      </div>
      <div style={{
        display: "flex", gap: 22, fontFamily: '"Source Serif 4", serif', fontSize: 14,
        color: light ? "rgba(31,27,23,0.75)" : "rgba(245,239,230,0.75)",
      }}>
        <span>Posts</span><span>Vídeos</span><span>Newsletter</span><span>Sobre</span>
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
      <Label muted={muted} size={10}>artigo · 8 min</Label>
      <div style={{
        fontFamily: '"Source Serif 4", serif', fontSize: 18, fontWeight: 500,
        color: ink, lineHeight: 1.3, marginTop: 4, letterSpacing: "-0.015em",
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
    <div style={{ fontSize: 14, lineHeight: 1.6 }}>
      Abraço,<br/>Thiago
    </div>
    <div style={{
      marginTop: 16, paddingTop: 14,
      borderTop: `1px solid ${line}`,
    }}>
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
    {/* frente */}
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
    {/* verso */}
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
        <Label muted={muted} size={10}>{theme} · final · v4</Label>
        <div style={{ fontSize: 38, fontWeight: 500, marginTop: 6, letterSpacing: "-0.025em", lineHeight: 1 }}>
          Carimbo + Fleuron
        </div>
        <div style={{
          fontSize: 14, lineHeight: 1.5, marginTop: 8, fontStyle: "italic", fontWeight: 300,
          color: ink, opacity: 0.75, maxWidth: 640,
        }}>
          Carimbo (primary mark) com 4 níveis de simplificação por tamanho.
          Foto substitui o miolo nas versões grandes. Fleuron (typographic secondary)
          pra signatures, end-marks e citações.
        </div>
      </div>

      {/* HIERARQUIA POR TAMANHO — sem foto */}
      <Panel title="01 · Carimbo · 4 níveis" role="hierarquia por tamanho" line={line} muted={muted} card={card}>
        <div style={{ display: "flex", gap: 36, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <CarimboFull ink={ink} accent={ACCENT} size={144}/>
            <Label muted={muted} size={9.5}>Full · ≥96px</Label>
            <Caption muted={muted}>texto orbital + duplo ring</Caption>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <CarimboSimplified ink={ink} accent={ACCENT} size={88}/>
            <Label muted={muted} size={9.5}>Simplified · 48–96</Label>
            <Caption muted={muted}>duplo ring + TF + dot</Caption>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <CarimboMark ink={ink} accent={ACCENT} size={48}/>
            <Label muted={muted} size={9.5}>Mark · 24–48</Label>
            <Caption muted={muted}>ring laranja + TF</Caption>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <CarimboMini ink={ink} accent={ACCENT} size={32}/>
            <Label muted={muted} size={9.5}>Mini · 16–24</Label>
            <Caption muted={muted}>laranja sólido</Caption>
          </div>
        </div>
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${line}` }}>
          <Label muted={muted} size={9.5}>Auto · seleção por tamanho</Label>
          <div style={{ display: "flex", gap: 28, alignItems: "flex-end", marginTop: 14 }}>
            {[16, 24, 32, 48, 64, 96, 144].map((s) => (
              <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <CarimboAuto ink={ink} accent={ACCENT} size={s}/>
                <Label muted={muted} size={9.5}>{s}</Label>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* CARIMBO + FOTO */}
      <Panel title="02 · Carimbo + foto · 3 níveis" role="foto substitui o miolo" line={line} muted={muted} card={card}>
        <div style={{ display: "flex", gap: 36, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <CarimboPhotoFull ink={ink} accent={ACCENT} size={144}/>
            <Label muted={muted} size={9.5}>Full · ≥96px</Label>
            <Caption muted={muted}>foto cropada + texto orbital</Caption>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <CarimboPhotoSimplified ink={ink} accent={ACCENT} size={88}/>
            <Label muted={muted} size={9.5}>Simplified · 32–96</Label>
            <Caption muted={muted}>ring laranja + foto</Caption>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <CarimboPhotoMark ink={ink} accent={ACCENT} size={48}/>
            <Label muted={muted} size={9.5}>Mark · &lt;32px</Label>
            <Caption muted={muted}>foto + ring fino</Caption>
          </div>
        </div>
        <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${line}` }}>
          <Label muted={muted} size={9.5}>Auto · cascata por tamanho</Label>
          <div style={{ display: "flex", gap: 28, alignItems: "flex-end", marginTop: 14 }}>
            {[24, 32, 48, 64, 96, 144].map((s) => (
              <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <CarimboPhotoAuto ink={ink} accent={ACCENT} size={s}/>
                <Label muted={muted} size={9.5}>{s}</Label>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* FLEURON */}
      <Panel title="03 · Fleuron inline" role="signature · footer · end-mark · citação" line={line} muted={muted} card={card}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {[14, 18, 22].map((s) => (
            <div key={s}>
              <Label muted={muted} size={9.5}>{s}px</Label>
              <div style={{ marginTop: 8 }}>
                <FleuronInline ink={ink} accent={ACCENT} size={s}/>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 8, paddingTop: 18, borderTop: `1px solid ${line}` }}>
            <Label muted={muted} size={9.5}>End-mark (fim de artigo)</Label>
            <div style={{ marginTop: 14 }}>
              <FleuronEndmark accent={ACCENT} size={22}/>
            </div>
          </div>
        </div>
      </Panel>

      {/* APLICAÇÕES */}
      <Panel title="04 · Header de site" role="navigation · Carimbo Mark + nome" line={line} muted={muted} card={card}>
        <HeaderApp ink={ink} accent={ACCENT} line={line} light={light}/>
      </Panel>

      <Panel title="05 · Card de post" role="listing · com foto e sem foto" line={line} muted={muted} card={card}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <PostCardApp ink={ink} accent={ACCENT} line={line} muted={muted} card={light ? "#fff" : "#0F0D0B"} withPhoto={true}/>
          <PostCardApp ink={ink} accent={ACCENT} line={line} muted={muted} card={light ? "#fff" : "#0F0D0B"} withPhoto={false}/>
        </div>
      </Panel>

      <Panel title="06 · OG image · 1200×630" role="social share" line={line} muted={muted} card={card}>
        <OGImageApp accent={ACCENT}/>
      </Panel>

      <Panel title="07 · Email signature" role="Fleuron inline" line={line} muted={muted} card={card}>
        <EmailSignatureApp ink={ink} accent={ACCENT} line={line} card={light ? "#fff" : "#0F0D0B"}/>
      </Panel>

      <Panel title="08 · Fim de artigo · author bio" role="Fleuron end-mark + Carimbo+foto" line={line} muted={muted} card={card}>
        <BlogEndmarkApp ink={ink} accent={ACCENT} line={line} card={light ? "#fff" : "#0F0D0B"} muted={muted}/>
      </Panel>

      <Panel title="09 · Cartão de visita" role="frente Carimbo Full · verso Fleuron" line={line} muted={muted} card={card}>
        <BusinessCardApp ink={ink} accent={ACCENT} line={line}/>
      </Panel>

      {/* FAVICON FINAL TEST */}
      <Panel title="10 · Favicon · prova final" role="16 / 24 / 32 reais · TF + foto" line={line} muted={muted} card={card}>
        <div style={{ display: "flex", gap: 40, alignItems: "flex-end" }}>
          <div>
            <Label muted={muted} size={9.5}>Carimbo Mini · favicon padrão</Label>
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
            <Label muted={muted} size={9.5}>Carimbo+Foto · profile pic</Label>
            <div style={{ display: "flex", gap: 22, marginTop: 14, alignItems: "flex-end" }}>
              {[24, 32, 48].map((s) => (
                <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <CarimboPhotoAuto ink={ink} accent={ACCENT} size={s}/>
                  <Label muted={muted} size={9.5}>{s}</Label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
};

function App() {
  return (
    <DesignCanvas
      title="Carimbo + Fleuron · sistema final"
      subtitle="THIAGO FIGUEIREDO · STUDIO. Carimbo (primary) com 4 níveis · foto substitui miolo · Fleuron pra typography inline."
      bg="#EFE9DC"
    >
      <DCSection id="light" title="Light">
        <DCArtboard id="sheet-light" label="Sistema completo · light" width={1000} height={3400}>
          <FullSheet theme="light"/>
        </DCArtboard>
      </DCSection>
      <DCSection id="dark" title="Dark">
        <DCArtboard id="sheet-dark" label="Sistema completo · dark" width={1000} height={3400}>
          <FullSheet theme="dark"/>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
