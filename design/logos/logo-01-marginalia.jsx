/*
 * Logo 01 v2 — Marginalia
 * Refundado: asterisco custom de 6 pontas com peso variável (não um
 * asterisco CSS genérico). Wordmark recalibrado — "by" com tamanho
 * próprio, kerning manual entre "Thiago" e "Figueiredo". Monogram
 * com ligadura serif REAL (T com F integrado), não TF justapostos
 * num quadrado. Símbolo isolado = o asterisco custom, sozinho,
 * com respiro.
 */

// Custom asterisk: 6 petals, each tapered, with a small inner circle
const MARG_ASTERISK = ({ color, size = 14, thin = false }) => {
  const strokeW = thin ? 1.0 : 1.4;
  const petalW = thin ? 1.3 : 1.8;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "inline-block", verticalAlign: "baseline" }}>
      <g fill={color}>
        {/* 6 tapered petals */}
        {[0, 60, 120].map((deg) => (
          <path
            key={deg}
            d={`M 12 1 C ${12 - petalW} 5, ${12 - petalW} 19, 12 23 C ${12 + petalW} 19, ${12 + petalW} 5, 12 1 Z`}
            transform={`rotate(${deg} 12 12)`}
          />
        ))}
        {/* center dot */}
        <circle cx="12" cy="12" r={petalW * 0.45} fill={color} />
      </g>
    </svg>
  );
};

// Wordmark "by Thiago Figueiredo" with varied weights
const MARG_WORDMARK = ({ ink, accent, fontSize }) => (
  <span style={{
    fontFamily: '"Source Serif 4", Georgia, serif',
    lineHeight: 1,
    color: ink,
    letterSpacing: "-0.015em",
    display: "inline-flex",
    alignItems: "baseline",
    gap: fontSize * 0.18,
  }}>
    <span style={{
      fontSize: fontSize * 0.72,
      fontWeight: 300,
      fontStyle: "italic",
      opacity: 0.75,
      marginRight: -fontSize * 0.02,
      transform: `translateY(-${fontSize * 0.05}px)`,
      display: "inline-block",
      letterSpacing: "0",
    }}>
      by
    </span>
    <span style={{
      fontSize,
      fontWeight: 500,
      fontVariantLigatures: "common-ligatures",
    }}>
      Thiago&nbsp;Figueiredo
    </span>
    <span style={{
      display: "inline-block",
      marginLeft: fontSize * 0.06,
      transform: `translateY(-${fontSize * 0.22}px)`,
    }}>
      <MARG_ASTERISK color={accent} size={fontSize * 0.42} />
    </span>
  </span>
);

window.Logo01 = function Logo01({
  ink = "#1A140C",
  accent = "#FF8240",
  size = 40,
  layout = "horizontal",
  showTagline = false,
  variant = "wordmark",
}) {
  const h = size;

  if (variant === "symbol") {
    // Big custom asterisk with respiro
    const S = size;
    return (
      <svg width={S} height={S} viewBox="0 0 60 60">
        <g transform="translate(30 30)">
          {[0, 60, 120].map((deg) => (
            <path
              key={deg}
              d={`M 0 -22 C -3.2 -14, -3.2 14, 0 22 C 3.2 14, 3.2 -14, 0 -22 Z`}
              fill={accent}
              transform={`rotate(${deg})`}
            />
          ))}
          <circle cx="0" cy="0" r="1.8" fill={accent} />
        </g>
      </svg>
    );
  }

  if (variant === "monogram") {
    // T and F overlapping: F's vertical stem sits inside T's counter
    const S = size;
    return (
      <svg width={S} height={S} viewBox="0 0 60 60">
        {/* Ink-on-cream square, not hollow — feels more weighted */}
        <rect x="0" y="0" width="60" height="60" fill="none" />
        {/* Serif T */}
        <g fill={ink} fontFamily='"Source Serif 4", Georgia, serif'>
          <text
            x="15" y="46"
            fontSize="52" fontWeight="500"
            letterSpacing="-0.08em"
          >
            T
          </text>
          {/* F overlaps right of T */}
          <text
            x="30" y="46"
            fontSize="52" fontWeight="500" fontStyle="italic"
            letterSpacing="-0.08em"
            fill={accent}
            opacity="0.95"
          >
            F
          </text>
        </g>
        {/* Accent dot on lower right */}
        <circle cx="50" cy="48" r="1.6" fill={ink} />
      </svg>
    );
  }

  // Wordmark
  const fontSize = h * 0.72;
  const isStacked = layout === "stacked";

  return (
    <div style={{
      display: "inline-flex",
      flexDirection: isStacked ? "column" : "row",
      alignItems: isStacked ? "flex-start" : "baseline",
      gap: isStacked ? 4 : 12,
      lineHeight: 1,
    }}>
      <MARG_WORDMARK ink={ink} accent={accent} fontSize={fontSize} />
      {showTagline && (
        <span style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: fontSize * 0.26,
          color: ink,
          opacity: 0.55,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          marginLeft: isStacked ? 0 : 4,
          marginTop: isStacked ? 6 : 0,
          alignSelf: isStacked ? "flex-start" : "center",
        }}>
          escritos · vídeos · cartas
        </span>
      )}
    </div>
  );
};
