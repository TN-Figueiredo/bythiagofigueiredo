/*
 * Logo 07 v2 — Signature
 * Refundado: o swoosh curvo saiu (era cliché lifestyle). Substituído
 * por um traço de pena mais sério: uma única linha reta sob o nome,
 * com uma pequena serifa em uma ponta (como se fosse o final de uma
 * caneta-tinteiro sendo levantada). Secondary mark em serif:
 * quando o logo precisa ser pequeno (favicon, avatar), a assinatura
 * vira "tf" serif italic com o traço, que é MUITO mais legível que
 * Caveat em 16px. Monograma agora é "TF" serif italic grande com a
 * mesma linha — consistência do sistema.
 */

// The signature underline — one stroke, serif cap on right end
const SIGNATURE_LINE = ({ color, width = 200, thickness = 1.5 }) => (
  <svg
    width={width} height={thickness * 3 + 4}
    viewBox={`0 0 ${width} ${thickness * 3 + 4}`}
    preserveAspectRatio="none"
    style={{ display: "block" }}
  >
    {/* Main line — slightly tapered with slight wobble at the end */}
    <path
      d={`M 2 ${thickness + 1} L ${width - 14} ${thickness + 1} C ${width - 10} ${thickness + 1}, ${width - 6} ${thickness + 2}, ${width - 3} ${thickness * 3 - 1}`}
      stroke={color}
      strokeWidth={thickness}
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

window.Logo07 = function Logo07({
  ink = "#1A140C",
  accent = "#FF8240",
  size = 40,
  layout = "horizontal",
  showTagline = false,
  variant = "wordmark",
}) {
  const h = size;

  if (variant === "symbol") {
    // Serif italic "TF" with the signature line — high legibility even small
    const S = size;
    return (
      <svg width={S} height={S} viewBox="0 0 60 60">
        {/* TF italic serif */}
        <text
          x="30" y="40" textAnchor="middle"
          fontFamily='"Source Serif 4", Georgia, serif'
          fontSize="40" fontWeight="500" fontStyle="italic"
          fill={ink} letterSpacing="-0.05em"
        >
          TF
        </text>
        {/* Signature line underneath with taper */}
        <path
          d="M 14 48 L 42 48 C 44 48, 46 48.5, 47 51"
          stroke={accent} strokeWidth="1.6" strokeLinecap="round" fill="none"
        />
        {/* Tiny period at end (signature dot) */}
        <circle cx="50" cy="52" r="1" fill={accent} />
      </svg>
    );
  }

  if (variant === "monogram") {
    const S = size;
    return (
      <svg width={S} height={S} viewBox="0 0 60 60">
        <circle cx="30" cy="30" r="28" fill="none" stroke={ink} strokeWidth="1.2" />
        {/* TF italic centered */}
        <text
          x="30" y="40" textAnchor="middle"
          fontFamily='"Source Serif 4", Georgia, serif'
          fontSize="28" fontWeight="500" fontStyle="italic"
          fill={ink} letterSpacing="-0.04em"
        >
          TF
        </text>
        {/* Signature line */}
        <path
          d="M 18 46 L 40 46 C 42 46, 43.5 46.5, 44.5 48"
          stroke={accent} strokeWidth="1.4" strokeLinecap="round" fill="none"
        />
      </svg>
    );
  }

  // Wordmark: Caveat name (still handwritten — that's the concept) but
  // with a SERIOUS straight underline instead of a swoosh.
  // Caveat is upgraded from 700 weight to paired with heavier ink.
  const fontSize = h * 1.0;
  const isStacked = layout === "stacked";

  return (
    <div style={{
      display: "inline-flex",
      flexDirection: isStacked ? "column" : "row",
      alignItems: isStacked ? "flex-start" : "baseline",
      gap: isStacked ? 4 : 12,
      lineHeight: 0.9,
      position: "relative",
    }}>
      <span style={{ position: "relative", display: "inline-block" }}>
        <span style={{
          fontFamily: '"Caveat", cursive',
          fontSize,
          fontWeight: 700,
          color: ink,
          letterSpacing: "-0.005em",
          lineHeight: 0.9,
          WebkitTextStroke: `0.3px ${ink}`, // slight ink weight for legibility
        }}>
          Thiago Figueiredo
        </span>
        {/* Serious underline */}
        <div style={{
          position: "absolute",
          left: 0, right: fontSize * 0.05,
          bottom: -fontSize * 0.08,
          height: fontSize * 0.1,
          pointerEvents: "none",
        }}>
          <SIGNATURE_LINE color={accent} width={200} thickness={Math.max(1.2, fontSize * 0.04)} />
        </div>
      </span>
      {showTagline && (
        <span style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: fontSize * 0.24,
          color: ink,
          opacity: 0.6,
          fontStyle: "italic",
          marginLeft: isStacked ? 0 : 10,
          marginTop: isStacked ? 12 : 0,
          alignSelf: isStacked ? "flex-start" : "baseline",
        }}>
          autor, editor, tradutor de ideias
        </span>
      )}
    </div>
  );
};
