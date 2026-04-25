/*
 * Logo 05 v2 — Cartogram
 * Refundado: removido "EST. 2026 · SÃO PAULO" (cliché etsy).
 * Substituído por: "MARGINALIA" no arco superior (nome editorial),
 * "— BY THIAGO FIGUEIREDO —" no arco inferior (com dashes como
 * hairlines reais). Ornamentos: dois fleurons editoriais nas
 * laterais (não mais pontinhos). TF agora em ink sólido (não
 * laranja), com alto contraste. Fleuron laranja discreto
 * no topo e base. Em avatar 96px funciona perfeito; em favicon
 * 32px virou símbolo simplificado.
 */

// Editorial fleuron — small ornament
const FLEURON = ({ color, size = 8 }) => (
  <svg width={size} height={size} viewBox="0 0 10 10">
    <path
      d="M 5 1 C 5 3, 3 4, 1 5 C 3 6, 5 7, 5 9 C 5 7, 7 6, 9 5 C 7 4, 5 3, 5 1 Z"
      fill={color}
    />
  </svg>
);

const CART_STAMP = ({ ink, accent, size = 80, withFullText = true, inverted = false }) => {
  const cx = 50, cy = 50;
  const outerR = 47, middleR = 42, innerR = 32;
  const textTopR = 39;
  const textBotR = 39;

  const bg = inverted ? ink : "transparent";
  const strokeC = inverted ? accent : ink;
  const textC = inverted ? accent : ink;
  const centerC = inverted ? accent : ink;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <path
          id={`cart-arc-top-${size}`}
          d={`M ${cx - textTopR} ${cy - 2} A ${textTopR} ${textTopR} 0 0 1 ${cx + textTopR} ${cy - 2}`}
          fill="none"
        />
        <path
          id={`cart-arc-bot-${size}`}
          d={`M ${cx + textBotR} ${cy + 2} A ${textBotR} ${textBotR} 0 0 1 ${cx - textBotR} ${cy + 2}`}
          fill="none"
        />
      </defs>
      {inverted && <circle cx={cx} cy={cy} r={outerR} fill={bg} />}
      {/* outer ring — heavier */}
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke={strokeC} strokeWidth="2.2" />
      {/* middle hairline */}
      <circle cx={cx} cy={cy} r={middleR} fill="none" stroke={strokeC} strokeWidth="0.6" />

      {withFullText && (
        <>
          {/* top arc text */}
          <text
            fill={textC}
            fontFamily='"Source Serif 4", Georgia, serif'
            fontSize="9" letterSpacing="0.26em" fontWeight="500"
            fontStyle="italic"
          >
            <textPath href={`#cart-arc-top-${size}`} startOffset="50%" textAnchor="middle">
              Marginalia
            </textPath>
          </text>
          {/* bottom arc text */}
          <text
            fill={textC}
            fontFamily='"JetBrains Mono", monospace'
            fontSize="5.5" letterSpacing="0.35em" fontWeight="500"
          >
            <textPath href={`#cart-arc-bot-${size}`} startOffset="50%" textAnchor="middle">
              — BY THIAGO FIGUEIREDO —
            </textPath>
          </text>
          {/* Side fleurons — small diamonds */}
          <g transform={`translate(${cx - 40} ${cy})`}>
            <path d="M 0 -2.5 L 2 0 L 0 2.5 L -2 0 Z" fill={accent} />
          </g>
          <g transform={`translate(${cx + 40} ${cy})`}>
            <path d="M 0 -2.5 L 2 0 L 0 2.5 L -2 0 Z" fill={accent} />
          </g>
          {/* Top & bottom fleurons */}
          <g transform={`translate(${cx} ${cy - 25})`}>
            <path d="M 0 -2 C 0 -0.5, 1.5 0, 2.5 0 C 1.5 0, 0 0.5, 0 2 C 0 0.5, -1.5 0, -2.5 0 C -1.5 0, 0 -0.5, 0 -2 Z" fill={accent} opacity="0.85" />
          </g>
          <g transform={`translate(${cx} ${cy + 25})`}>
            <path d="M 0 -2 C 0 -0.5, 1.5 0, 2.5 0 C 1.5 0, 0 0.5, 0 2 C 0 0.5, -1.5 0, -2.5 0 C -1.5 0, 0 -0.5, 0 -2 Z" fill={accent} opacity="0.85" />
          </g>
        </>
      )}

      {/* Central monogram TF — large, ink (high contrast) */}
      <text
        x={cx} y={cy + 6}
        textAnchor="middle"
        fontFamily='"Source Serif 4", Georgia, serif'
        fontSize="24" fontWeight="600" fontStyle="italic"
        fill={centerC} letterSpacing="-0.05em"
      >
        TF
      </text>
      {/* Tiny accent hairline under TF */}
      <line
        x1={cx - 8} y1={cy + 12} x2={cx + 8} y2={cy + 12}
        stroke={accent} strokeWidth="1.1"
      />
    </svg>
  );
};

// Simplified mark for favicon/small sizes
const CART_MARK_SMALL = ({ ink, accent, size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="18.5" fill="none" stroke={ink} strokeWidth="1.6" />
    <circle cx="20" cy="20" r="14.5" fill="none" stroke={ink} strokeWidth="0.5" />
    <text
      x="20" y="25" textAnchor="middle"
      fontFamily='"Source Serif 4", Georgia, serif'
      fontSize="16" fontWeight="600" fontStyle="italic"
      fill={ink} letterSpacing="-0.05em"
    >
      TF
    </text>
    <circle cx="20" cy="6" r="0.9" fill={accent} />
    <circle cx="20" cy="34" r="0.9" fill={accent} />
  </svg>
);

window.Logo05 = function Logo05({
  ink = "#1A140C",
  accent = "#FF8240",
  size = 40,
  layout = "horizontal",
  showTagline = false,
  variant = "wordmark",
}) {
  const h = size;

  if (variant === "symbol") {
    // Full stamp
    return <CART_STAMP ink={ink} accent={accent} size={size * 1.2} withFullText={size >= 40} />;
  }

  if (variant === "monogram") {
    return <CART_MARK_SMALL ink={ink} accent={accent} size={size} />;
  }

  // Wordmark
  const stampSize = h * 1.25;
  const fontSize = h * 0.58;
  const isStacked = layout === "stacked";

  return (
    <div style={{
      display: "inline-flex",
      flexDirection: isStacked ? "column" : "row",
      alignItems: isStacked ? "flex-start" : "center",
      gap: isStacked ? 10 : 14,
      lineHeight: 1,
    }}>
      <CART_MARK_SMALL ink={ink} accent={accent} size={stampSize} />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize,
          fontWeight: 500,
          color: ink,
          letterSpacing: "-0.015em",
          lineHeight: 1,
        }}>
          Thiago Figueiredo
        </span>
        <span style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: fontSize * 0.58,
          color: ink,
          opacity: 0.7,
          fontStyle: "italic",
          fontWeight: 400,
          letterSpacing: "0.02em",
        }}>
          Marginalia
        </span>
        {showTagline && (
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: fontSize * 0.3,
            color: ink,
            opacity: 0.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginTop: 2,
          }}>
            autor · publicador
          </span>
        )}
      </div>
    </div>
  );
};
