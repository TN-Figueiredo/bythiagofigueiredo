/*
 * Logo 08 — Brackets
 * Conceito: nome envelope em colchetes, como um array JSON ou
 * uma citação editorial. Híbrido: dev + editorial.
 * [ thiago.figueiredo ]
 *
 * Monogram: [tf] compacto.
 * Símbolo: só os colchetes com um ponto laranja no meio.
 */

window.Logo08 = function Logo08({
  ink = "#1A140C",
  accent = "#FF8240",
  size = 40,
  layout = "horizontal",
  showSymbol = true,
  showTagline = false,
  variant = "wordmark",
}) {
  const h = size;

  if (variant === "symbol") {
    // [•]
    const S = size;
    return (
      <svg width={S} height={S} viewBox="0 0 60 60">
        <path d="M 18 12 L 10 12 L 10 48 L 18 48" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="square" />
        <path d="M 42 12 L 50 12 L 50 48 L 42 48" stroke={ink} strokeWidth="3" fill="none" strokeLinecap="square" />
        <circle cx="30" cy="30" r="5" fill={accent} />
      </svg>
    );
  }

  if (variant === "monogram") {
    const S = size;
    return (
      <svg width={S} height={S} viewBox="0 0 60 60">
        <rect x="2" y="2" width="56" height="56" rx="3" fill="none" stroke={ink} strokeWidth="1.5" />
        <text
          x="14" y="38"
          fontFamily='"JetBrains Mono", monospace'
          fontSize="28" fontWeight="700"
          fill={ink}
        >
          [
        </text>
        <text
          x="30" y="38" textAnchor="middle"
          fontFamily='"Source Serif 4", Georgia, serif'
          fontSize="22" fontWeight="600" fontStyle="italic"
          fill={accent} letterSpacing="-0.03em"
        >
          tf
        </text>
        <text
          x="46" y="38"
          fontFamily='"JetBrains Mono", monospace'
          fontSize="28" fontWeight="700"
          fill={ink}
        >
          ]
        </text>
      </svg>
    );
  }

  const fontSize = h * 0.62;
  const bracketSize = h * 0.9;
  const isStacked = layout === "stacked";

  return (
    <div style={{
      display: "inline-flex",
      flexDirection: isStacked ? "column" : "row",
      alignItems: isStacked ? "flex-start" : "baseline",
      gap: isStacked ? 3 : 10,
      lineHeight: 1,
    }}>
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: fontSize * 0.3 }}>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: bracketSize,
          fontWeight: 400,
          color: ink,
          lineHeight: 1,
        }}>
          [
        </span>
        <span style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize,
          fontWeight: 500,
          color: ink,
          letterSpacing: "-0.015em",
          fontStyle: "italic",
        }}>
          thiago<span style={{ color: accent, fontWeight: 700, fontStyle: "normal" }}>.</span>figueiredo
        </span>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: bracketSize,
          fontWeight: 400,
          color: ink,
          lineHeight: 1,
        }}>
          ]
        </span>
      </span>
      {showTagline && (
        <span style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: fontSize * 0.38,
          color: ink,
          opacity: 0.55,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginLeft: isStacked ? 0 : 8,
          marginTop: isStacked ? 4 : 0,
        }}>
          v0.1.0
        </span>
      )}
    </div>
  );
};
