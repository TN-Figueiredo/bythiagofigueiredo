/*
 * Logo 02 — The Terminal
 * Conceito: indie hacker / dev. Nome como comando de terminal,
 * precedido de $ prompt e seguido de cursor piscando.
 * $ thiago_
 *
 * Para animação: cursor pisca via CSS. No SVG estático, fica sólido.
 * Monogram: "tf" lowercase com cursor após.
 * Símbolo: só o prompt "$_" em caixa.
 */

window.Logo02 = function Logo02({
  ink = "#1A140C",
  accent = "#FF8240",
  size = 40,
  layout = "horizontal",
  showSymbol = true,
  showTagline = false,
  variant = "wordmark",
  animated = true,
}) {
  const h = size;

  if (variant === "symbol") {
    // Box with $_ inside
    const S = size;
    return (
      <svg width={S} height={S} viewBox="0 0 60 60">
        <rect x="2" y="2" width="56" height="56" rx="4" fill={ink} />
        <text x="14" y="40" fontFamily='"JetBrains Mono", monospace' fontSize="28" fontWeight="700" fill={accent}>$</text>
        <rect x="34" y="32" width="14" height="3" fill={accent} className={animated ? "tt-cursor" : ""} />
        {animated && (
          <style>{`
            @keyframes ttblink { 0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 } }
            .tt-cursor { animation: ttblink 1s steps(1) infinite; }
          `}</style>
        )}
      </svg>
    );
  }

  if (variant === "monogram") {
    const S = size;
    return (
      <svg width={S} height={S} viewBox="0 0 60 60">
        <rect x="2" y="2" width="56" height="56" rx="4" fill="none" stroke={ink} strokeWidth="1.5" />
        <text
          x="30" y="40" textAnchor="middle"
          fontFamily='"JetBrains Mono", monospace'
          fontSize="26" fontWeight="600"
          fill={ink}
        >
          tf
        </text>
        <rect x="42" y="20" width="2" height="22" fill={accent} className={animated ? "tt-cursor-m" : ""} />
        {animated && (
          <style>{`
            @keyframes ttblinkm { 0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 } }
            .tt-cursor-m { animation: ttblinkm 1s steps(1) infinite; }
          `}</style>
        )}
      </svg>
    );
  }

  // Wordmark: $ thiago_
  const fontSize = h * 0.65;
  const isStacked = layout === "stacked";

  return (
    <div style={{
      display: "inline-flex",
      flexDirection: isStacked ? "column" : "row",
      alignItems: isStacked ? "flex-start" : "baseline",
      gap: isStacked ? 3 : 10,
      lineHeight: 1,
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      <span style={{ fontSize, color: ink, fontWeight: 500, display: "inline-flex", alignItems: "baseline" }}>
        <span style={{ color: accent, marginRight: fontSize * 0.35, fontWeight: 700 }}>$</span>
        <span>thiago figueiredo</span>
        <span
          style={{
            display: "inline-block",
            width: fontSize * 0.55,
            height: fontSize * 0.95,
            background: accent,
            marginLeft: fontSize * 0.18,
            verticalAlign: "baseline",
            transform: `translateY(${fontSize * 0.1}px)`,
          }}
          className={animated ? "tt-cursor-w" : ""}
        />
      </span>
      {showTagline && (
        <span style={{
          fontSize: fontSize * 0.45,
          color: ink,
          opacity: 0.55,
          marginLeft: isStacked ? 0 : 8,
          marginTop: isStacked ? 3 : 0,
        }}>
          # blog + canal
        </span>
      )}
      {animated && (
        <style>{`
          @keyframes ttblinkw { 0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 } }
          .tt-cursor-w { animation: ttblinkw 1s steps(1) infinite; }
        `}</style>
      )}
    </div>
  );
};
