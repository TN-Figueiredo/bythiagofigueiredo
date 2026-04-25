/*
 * Logo 04 — The Hub
 * Conceito: hub central → ponto com 4 linhas saindo (N/S/E/W).
 * Metáfora: um lugar central pra onde tudo converge (blog, vídeo, newsletter).
 * Sans geométrico moderno pra acompanhar.
 *
 * Símbolo: o próprio hub-ícone (ponto + 4 linhas).
 * Monogram: TF dentro de um quadrado com as 4 linhas tangenciando.
 */

const HUB_MARK = (ink, accent, size = 40) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    {/* 4 lines extending from center — each stops short of edge */}
    <line x1="20" y1="4"  x2="20" y2="14" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
    <line x1="20" y1="26" x2="20" y2="36" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
    <line x1="4"  y1="20" x2="14" y2="20" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
    <line x1="26" y1="20" x2="36" y2="20" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
    {/* central circle */}
    <circle cx="20" cy="20" r="6" fill={accent} />
    <circle cx="20" cy="20" r="2" fill="#FAF6ED" />
  </svg>
);

window.Logo04 = function Logo04({
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
    return HUB_MARK(ink, accent, size);
  }

  if (variant === "monogram") {
    const S = size;
    return (
      <svg width={S} height={S} viewBox="0 0 60 60">
        <rect x="8" y="8" width="44" height="44" rx="2" fill="none" stroke={ink} strokeWidth="1.5" />
        {/* 4 extending lines from square edges */}
        <line x1="30" y1="0" x2="30" y2="8" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="30" y1="52" x2="30" y2="60" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="0" y1="30" x2="8" y2="30" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
        <line x1="52" y1="30" x2="60" y2="30" stroke={ink} strokeWidth="1.8" strokeLinecap="round" />
        <text
          x="30" y="40" textAnchor="middle"
          fontFamily='"Inter", sans-serif'
          fontSize="22" fontWeight="700"
          fill={ink} letterSpacing="-0.04em"
        >
          TF
        </text>
        <circle cx="30" cy="14" r="1.8" fill={accent} />
      </svg>
    );
  }

  const fontSize = h * 0.58;
  const markSize = h * 0.95;
  const isStacked = layout === "stacked";

  return (
    <div style={{
      display: "inline-flex",
      flexDirection: isStacked ? "column" : "row",
      alignItems: isStacked ? "flex-start" : "center",
      gap: isStacked ? 6 : 10,
      lineHeight: 1,
    }}>
      {HUB_MARK(ink, accent, markSize)}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{
          fontFamily: '"Inter", system-ui, sans-serif',
          fontSize,
          fontWeight: 700,
          color: ink,
          letterSpacing: "-0.035em",
        }}>
          thiago figueiredo
        </span>
        {showTagline && (
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: fontSize * 0.38,
            color: ink,
            opacity: 0.55,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}>
            a central hub
          </span>
        )}
      </div>
    </div>
  );
};
