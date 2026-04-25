/*
 * Logo 03 v2 — Figueira
 * Refundado: árvore com caráter — tronco espesso com curva sutil,
 * galhos assimétricos com peso (não pauzinhos), 3 figos de
 * tamanhos variados numa composição balanceada. Removida a linha
 * do chão (destoava). Integrado com o wordmark via baseline
 * compartilhada. Monogram: figueira num selo circular com TF
 * serif italic sob a copa (não o nome inteiro). Símbolo standalone
 * ganhou respiro e uma moldura editorial fina.
 */

const FIGUEIRA_TREE = ({ ink, accent, size = 50, withFrame = false }) => (
  <svg width={size} height={size} viewBox="0 0 50 50" style={{ display: "block" }}>
    {withFrame && (
      <circle cx="25" cy="25" r="23.5" fill="none" stroke={ink} strokeWidth="0.8" opacity="0.4" />
    )}
    {/* Trunk — tapered, with a slight curve to the right */}
    <path
      d="M 24 46 C 24 38, 26 34, 25 28 C 24 24, 23 22, 24 18"
      stroke={ink}
      strokeWidth="2.4"
      strokeLinecap="round"
      fill="none"
    />
    {/* Left branch — upward curve */}
    <path
      d="M 24.5 30 C 20 28, 15 24, 12 19"
      stroke={ink}
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
    />
    {/* Right branch — longer, curving up */}
    <path
      d="M 25 26 C 30 24, 35 20, 37 14"
      stroke={ink}
      strokeWidth="1.8"
      strokeLinecap="round"
      fill="none"
    />
    {/* Top branch */}
    <path
      d="M 24.2 22 C 24 16, 24.5 12, 25 8"
      stroke={ink}
      strokeWidth="1.6"
      strokeLinecap="round"
      fill="none"
    />
    {/* Three figs — varied sizes, asymmetric */}
    {/* Large one on left — the star */}
    <circle cx="11" cy="17" r="5.5" fill={accent} />
    <path d="M 11 11.5 L 11 9" stroke={ink} strokeWidth="1" strokeLinecap="round" />
    {/* Medium on right */}
    <circle cx="37" cy="12.5" r="4" fill={accent} opacity="0.88" />
    <path d="M 37 8.5 L 37 6.5" stroke={ink} strokeWidth="0.8" strokeLinecap="round" />
    {/* Small at top */}
    <circle cx="25" cy="7" r="2.8" fill={accent} opacity="0.75" />
    <path d="M 25 4.2 L 25 2.8" stroke={ink} strokeWidth="0.6" strokeLinecap="round" />
  </svg>
);

window.Logo03 = function Logo03({
  ink = "#1A140C",
  accent = "#FF8240",
  size = 40,
  layout = "horizontal",
  showTagline = false,
  variant = "wordmark",
}) {
  const h = size;

  if (variant === "symbol") {
    // Large tree with minimal frame
    const S = size;
    return (
      <svg width={S} height={S} viewBox="0 0 60 60">
        {/* thin editorial frame */}
        <rect x="3" y="3" width="54" height="54" fill="none" stroke={ink} strokeWidth="0.6" opacity="0.3" />
        {/* tree shifted 5px in each direction to fit frame */}
        <g transform="translate(5 5)">
          <path d="M 24 46 C 24 38, 26 34, 25 28 C 24 24, 23 22, 24 18" stroke={ink} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M 24.5 30 C 20 28, 15 24, 12 19" stroke={ink} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M 25 26 C 30 24, 35 20, 37 14" stroke={ink} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M 24.2 22 C 24 16, 24.5 12, 25 8" stroke={ink} strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <circle cx="11" cy="17" r="5.5" fill={accent} />
          <circle cx="37" cy="12.5" r="4" fill={accent} opacity="0.88" />
          <circle cx="25" cy="7" r="2.8" fill={accent} opacity="0.75" />
        </g>
      </svg>
    );
  }

  if (variant === "monogram") {
    // Circular seal: tree above, "TF" italic serif below
    const S = size;
    return (
      <svg width={S} height={S} viewBox="0 0 60 60">
        <circle cx="30" cy="30" r="28.5" fill="none" stroke={ink} strokeWidth="1.4" />
        <circle cx="30" cy="30" r="24" fill="none" stroke={ink} strokeWidth="0.5" opacity="0.5" />
        {/* small tree top-center */}
        <g transform="translate(12 4) scale(0.7)">
          <path d="M 24 38 C 24 32, 26 28, 25 24" stroke={ink} strokeWidth="2.4" strokeLinecap="round" fill="none" />
          <path d="M 24.5 28 C 20 26, 15 22, 12 17" stroke={ink} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M 25 24 C 30 22, 35 18, 37 12" stroke={ink} strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <circle cx="11" cy="15" r="5.5" fill={accent} />
          <circle cx="37" cy="10.5" r="4" fill={accent} opacity="0.88" />
        </g>
        {/* TF italic below */}
        <text
          x="30" y="48" textAnchor="middle"
          fontFamily='"Source Serif 4", Georgia, serif'
          fontSize="16" fontWeight="500" fontStyle="italic"
          fill={ink} letterSpacing="-0.02em"
        >
          TF
        </text>
      </svg>
    );
  }

  // Wordmark — tree integrated with serif wordmark at baseline
  const fontSize = h * 0.72;
  const treeSize = h * 1.15;
  const isStacked = layout === "stacked";

  return (
    <div style={{
      display: "inline-flex",
      flexDirection: isStacked ? "column" : "row",
      alignItems: isStacked ? "flex-start" : "flex-end",
      gap: isStacked ? 4 : 12,
      lineHeight: 1,
    }}>
      <div style={{ marginBottom: isStacked ? 0 : -fontSize * 0.08 }}>
        <FIGUEIRA_TREE ink={ink} accent={accent} size={treeSize} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize,
          fontWeight: 500,
          color: ink,
          letterSpacing: "-0.015em",
          lineHeight: 1,
        }}>
          Thiago<span style={{ fontStyle: "italic", fontWeight: 400 }}> Figueiredo</span>
        </span>
        {showTagline && (
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: fontSize * 0.26,
            color: ink,
            opacity: 0.55,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginTop: 2,
          }}>
            um figueiral pessoal
          </span>
        )}
      </div>
    </div>
  );
};
