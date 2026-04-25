/*
 * Logo 06 — Junction
 * Conceito: o CMS é o meio. Duas linhas convergem num ponto e saem
 * em 4 direções — metáfora da junction table (um post, vários destinos).
 * Abstrato, moderno, técnico sem ser "dev-y" demais.
 *
 * Wordmark: o símbolo + nome em sans geométrico.
 * Monogram: o símbolo dentro de um círculo.
 */

const JUNCTION_MARK = (ink, accent, size = 40) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    {/* Two lines crossing at center, with an accent dot */}
    <line x1="6" y1="20" x2="34" y2="20" stroke={ink} strokeWidth="2" strokeLinecap="round" />
    <line x1="20" y1="6" x2="20" y2="34" stroke={ink} strokeWidth="2" strokeLinecap="round" />
    {/* Junction node */}
    <circle cx="20" cy="20" r="5.5" fill="#FAF6ED" stroke={ink} strokeWidth="2" />
    <circle cx="20" cy="20" r="2.5" fill={accent} />
    {/* Tiny endpoint dots */}
    <circle cx="6" cy="20" r="1.2" fill={ink} />
    <circle cx="34" cy="20" r="1.2" fill={ink} />
    <circle cx="20" cy="6" r="1.2" fill={ink} />
    <circle cx="20" cy="34" r="1.2" fill={ink} />
  </svg>
);

window.Logo06 = function Logo06({
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
    return JUNCTION_MARK(ink, accent, size);
  }

  if (variant === "monogram") {
    const S = size;
    return (
      <svg width={S} height={S} viewBox="0 0 60 60">
        <circle cx="30" cy="30" r="28" fill={ink} />
        <line x1="12" y1="30" x2="48" y2="30" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
        <line x1="30" y1="12" x2="30" y2="48" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="30" cy="30" r="7" fill={ink} stroke={accent} strokeWidth="2" />
        <text
          x="30" y="34" textAnchor="middle"
          fontFamily='"Inter", sans-serif'
          fontSize="8" fontWeight="700"
          fill="#FAF6ED" letterSpacing="-0.02em"
        >
          TF
        </text>
      </svg>
    );
  }

  const fontSize = h * 0.6;
  const markSize = h * 0.9;
  const isStacked = layout === "stacked";

  return (
    <div style={{
      display: "inline-flex",
      flexDirection: isStacked ? "column" : "row",
      alignItems: isStacked ? "flex-start" : "center",
      gap: isStacked ? 6 : 10,
      lineHeight: 1,
    }}>
      {JUNCTION_MARK(ink, accent, markSize)}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{
          fontFamily: '"Inter", system-ui, sans-serif',
          fontSize,
          fontWeight: 600,
          color: ink,
          letterSpacing: "-0.025em",
        }}>
          Thiago Figueiredo
        </span>
        {showTagline && (
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: fontSize * 0.38,
            color: ink,
            opacity: 0.55,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}>
            publica uma vez, distribui
          </span>
        )}
      </div>
    </div>
  );
};
