/*
 * Logos.jsx v2 — focado nos 4 finalistas (01, 03, 05, 07).
 * Auditoria expandida: cada logo tem uma PÁGINA INTEIRA dedicada,
 * não um card. Mostra o sistema completo + mockups realistas em
 * mais cenários + auditoria de contraste light/dark lado a lado +
 * favicon 16px vs 32px vs 48px.
 */

const { useState } = React;

const LOGOS_V2 = [
  {
    id: 1,
    name: "Marginalia",
    tagline: "editorial · asterisco",
    component: window.Logo01,
    concept: "Serif de revista literária com um asterisco editorial custom de 6 pétalas no lugar do ponto final. O ‘by’ italic tem peso próprio. O monograma usa T e F serif que se tocam — integração, não justaposição.",
    revision: "v2: asterisco desenhado do zero (6 pétalas afiladas, não CSS). Peso italic recalibrado no ‘by’. Monograma com T serif + F italic sobrepostos, ponto de acento no rodapé — vira um sistema.",
  },
  {
    id: 3,
    name: "Figueira",
    tagline: "ilustração · literário",
    component: window.Logo03,
    concept: "Árvore orgânica-mas-geométrica com três figos em tamanhos variados (5.5, 4, 2.8 de raio). Puxa o sobrenome sem ser cute. Wordmark em serif com ‘Figueiredo’ em italic — o nome também é arborescente.",
    revision: "v2: árvore redesenhada do zero — tronco espesso curvo, 3 galhos assimétricos, hierarquia nos figos, sem linha do chão. Monograma = selo circular com a copa + TF italic embaixo.",
  },
  {
    id: 5,
    name: "Cartogram",
    tagline: "vintage · carimbo",
    component: window.Logo05,
    concept: "Carimbo editorial com ‘Marginalia’ em serif italic no arco superior e ‘— BY THIAGO FIGUEIREDO —’ em monospace no inferior. TF italic no centro em tinta sólida (alto contraste). Fleurons laranja nas laterais.",
    revision: "v2: removido o ‘EST. 2026 · SÃO PAULO’ (cliché etsy). Substituído por nome editorial + fleurons de diamante e losango (ornamento real, não pontinho). TF virou ink — contraste corrigido.",
  },
  {
    id: 7,
    name: "Signature",
    tagline: "assinatura · pessoal",
    component: window.Logo07,
    concept: "Assinatura manuscrita em Caveat com uma linha reta sob o nome que termina com uma pequena curva — traço de caneta-tinteiro, não swoosh. Secondary mark em serif italic TF para uso pequeno.",
    revision: "v2: swoosh curvo removido (cliché lifestyle). Substituído por traço sério com serifa final. Monograma e símbolo agora são TF serif italic (não Caveat) — legibilidade em 16px triplicada.",
  },
];

function Logos() {
  const [dark, setDark] = useState(false);
  const [mono, setMono] = useState(false);
  const [showTagline, setShowTagline] = useState(false);
  const [layout, setLayout] = useState("horizontal");
  const [focused, setFocused] = useState(null); // logo id to deep-dive

  const inkLight = "#1A140C";
  const inkDark = "#EDE8DB";
  const accentOn = "#FF8240";
  const bgLight = "#FAF6ED";
  const bgDark = "#14110B";

  const ink = dark ? inkDark : inkLight;
  const accent = mono ? ink : accentOn;
  const bg = dark ? bgDark : bgLight;
  const cardBg = dark ? "#1C1812" : "#FFFFFF";
  const line = dark ? "#2E2718" : "#E8DFC9";
  const muted = dark ? "#9A9179" : "#6E6550";

  const themeProps = { ink, accent, bg, cardBg, line, muted, dark };

  return (
    <div style={{
      minHeight: "100vh",
      background: bg,
      color: ink,
      fontFamily: '"Inter", system-ui, sans-serif',
      paddingTop: 60,
      paddingBottom: 80,
      transition: "background 0.15s, color 0.15s",
    }}>
      {/* Page header */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px" }}>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 11, color: accent, letterSpacing: "0.16em",
          textTransform: "uppercase", marginBottom: 18,
          fontWeight: 600,
        }}>
          Propostas refinadas · 4 finalistas · ciclo 2
        </div>
        <h1 style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 56, fontWeight: 500, letterSpacing: "-0.02em",
          lineHeight: 1.05, margin: 0, maxWidth: 880,
        }}>
          Quatro direções refinadas,<br />
          <span style={{ fontStyle: "italic", color: accent }}>auditadas em contexto</span>
        </h1>
        <p style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 19, color: muted, lineHeight: 1.55,
          marginTop: 24, maxWidth: 700,
        }}>
          Cada direção foi redesenhada do zero após os comentários.
          Agora cada logo tem sua página dedicada: wordmark, monograma e símbolo
          em light/dark lado a lado, aplicação em 6 contextos reais (header web,
          avatar, favicon 16/32, watermark em PDF, merch, email signature), e nota
          de auditoria sobre o que mudou do v1 pro v2.
        </p>

        <Controls
          dark={dark} setDark={setDark}
          mono={mono} setMono={setMono}
          showTagline={showTagline} setShowTagline={setShowTagline}
          layout={layout} setLayout={setLayout}
          accent={accent} ink={ink} line={line} cardBg={cardBg} muted={muted}
        />
      </div>

      {/* 4 full pages */}
      <div style={{ maxWidth: 1280, margin: "56px auto 0", padding: "0 32px", display: "flex", flexDirection: "column", gap: 48 }}>
        {LOGOS_V2.map((L) => (
          <LogoPage
            key={L.id}
            logo={L}
            {...themeProps}
            showTagline={showTagline}
            layout={layout}
          />
        ))}
      </div>

      {/* Footer */}
      <div style={{ maxWidth: 680, margin: "80px auto 0", padding: "0 32px", textAlign: "center" }}>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          color: muted, letterSpacing: "0.16em", textTransform: "uppercase",
          marginBottom: 12,
        }}>
          decisão final
        </div>
        <p style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 17, color: ink, lineHeight: 1.6, margin: 0,
        }}>
          Escolha uma ou combine. Eu monto a página de especificações com
          export em SVG, PNG em múltiplas resoluções, clear-space, paleta
          completa, e guia de uso.
        </p>
      </div>
    </div>
  );
}

function Controls({ dark, setDark, mono, setMono, showTagline, setShowTagline, layout, setLayout, accent, ink, line, cardBg, muted }) {
  return (
    <div style={{
      display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
      marginTop: 36, padding: "16px 20px",
      background: cardBg, border: `1px solid ${line}`,
    }}>
      <span style={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
        color: muted, letterSpacing: "0.14em", textTransform: "uppercase",
        marginRight: 6, fontWeight: 600,
      }}>
        controles globais
      </span>
      <ToggleBtn active={dark} onClick={() => setDark(!dark)} accent={accent} ink={ink} line={line}>
        {dark ? "dark" : "light"}
      </ToggleBtn>
      <ToggleBtn active={!mono} onClick={() => setMono(!mono)} accent={accent} ink={ink} line={line}>
        {mono ? "mono" : "com acento"}
      </ToggleBtn>
      <ToggleBtn active={showTagline} onClick={() => setShowTagline(!showTagline)} accent={accent} ink={ink} line={line}>
        {showTagline ? "com tagline" : "sem tagline"}
      </ToggleBtn>
      <ToggleBtn
        active={layout === "stacked"}
        onClick={() => setLayout(layout === "horizontal" ? "stacked" : "horizontal")}
        accent={accent} ink={ink} line={line}
      >
        {layout === "stacked" ? "empilhado" : "horizontal"}
      </ToggleBtn>
    </div>
  );
}

function ToggleBtn({ active, onClick, children, accent, ink, line }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 13px",
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 11, letterSpacing: "0.06em",
        textTransform: "lowercase",
        background: active ? accent : "transparent",
        color: active ? "#1A140C" : ink,
        border: `1px solid ${active ? accent : line}`,
        cursor: "pointer",
        fontWeight: active ? 600 : 500,
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

function LogoPage({ logo, ink, accent, bg, cardBg, line, muted, dark, showTagline, layout }) {
  const L = logo.component;

  // For "audit" columns, we render light and dark regardless of current mode
  const altInk = dark ? "#1A140C" : "#EDE8DB";
  const altBg = dark ? "#FAF6ED" : "#14110B";

  return (
    <div style={{
      background: cardBg,
      border: `1px solid ${line}`,
    }}>
      {/* Page header */}
      <div style={{
        padding: "28px 32px 22px",
        borderBottom: `1px solid ${line}`,
        display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 32,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10, color: accent, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 8, fontWeight: 700,
          }}>
            Direção 0{logo.id} · {logo.tagline}
          </div>
          <h2 style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontSize: 38, fontWeight: 500, letterSpacing: "-0.02em",
            margin: 0, color: ink, lineHeight: 1,
          }}>
            {logo.name}
          </h2>
          <p style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontSize: 15, color: muted, lineHeight: 1.55,
            marginTop: 14, marginBottom: 0, maxWidth: 680,
          }}>
            {logo.concept}
          </p>
        </div>
        <div style={{
          flexShrink: 0,
          padding: "10px 14px",
          background: `${accent}18`,
          border: `1px solid ${accent}40`,
          maxWidth: 320,
        }}>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 9, color: accent, letterSpacing: "0.18em",
            textTransform: "uppercase", marginBottom: 6, fontWeight: 700,
          }}>
            Mudanças do ciclo
          </div>
          <div style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontSize: 13, color: ink, lineHeight: 1.55, fontStyle: "italic",
          }}>
            {logo.revision}
          </div>
        </div>
      </div>

      {/* Big primary wordmark preview */}
      <div style={{
        padding: "56px 28px 52px",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: bg,
        borderBottom: `1px solid ${line}`,
        minHeight: 200,
      }}>
        <L ink={ink} accent={accent} size={52} showTagline={showTagline} layout={layout} variant="wordmark" />
      </div>

      {/* Light + Dark audit strip */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        borderBottom: `1px solid ${line}`,
      }}>
        <AuditPanel
          label="modo claro"
          bgColor={dark ? altBg : bg}
          inkColor={dark ? altInk : ink}
          L={L} accent={accent}
          line={dark ? "#E8DFC9" : line}
          muted={dark ? "#6E6550" : muted}
        />
        <AuditPanel
          label="modo escuro"
          bgColor={dark ? bg : altBg}
          inkColor={dark ? ink : altInk}
          L={L} accent={accent}
          line={dark ? line : "#2E2718"}
          muted={dark ? muted : "#9A9179"}
          border
        />
      </div>

      {/* System row: wordmark + monogram + symbol */}
      <div style={{
        padding: "28px 32px",
        display: "grid",
        gridTemplateColumns: "1fr 80px 80px 80px",
        alignItems: "center",
        gap: 28,
        borderBottom: `1px solid ${line}`,
      }}>
        <div>
          <MiniLabel muted={muted}>wordmark</MiniLabel>
          <div style={{ display: "flex", alignItems: "center", minHeight: 40 }}>
            <L ink={ink} accent={accent} size={28} variant="wordmark" />
          </div>
        </div>
        <div>
          <MiniLabel muted={muted}>monograma</MiniLabel>
          <L ink={ink} accent={accent} size={64} variant="monogram" />
        </div>
        <div>
          <MiniLabel muted={muted}>símbolo</MiniLabel>
          <L ink={ink} accent={accent} size={64} variant="symbol" />
        </div>
        <div>
          <MiniLabel muted={muted}>favicon</MiniLabel>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ textAlign: "center" }}>
              <L ink={ink} accent={accent} size={16} variant="symbol" />
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 8,
                color: muted, marginTop: 4, opacity: 0.7,
              }}>
                16
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <L ink={ink} accent={accent} size={32} variant="symbol" />
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 8,
                color: muted, marginTop: 4, opacity: 0.7,
              }}>
                32
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6 application mockups */}
      <div style={{
        padding: "28px 32px 32px",
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
      }}>
        <MockHeader L={L} ink={ink} accent={accent} line={line} muted={muted} cardBg={cardBg} bg={bg} />
        <MockAvatar L={L} ink={ink} accent={accent} line={line} muted={muted} />
        <MockBrowser L={L} ink={ink} accent={accent} line={line} muted={muted} cardBg={cardBg} />
        <MockWatermark L={L} ink={ink} accent={accent} line={line} muted={muted} />
        <MockEmail L={L} ink={ink} accent={accent} line={line} muted={muted} cardBg={cardBg} />
        <MockMerch L={L} ink={ink} accent={accent} line={line} muted={muted} />
      </div>
    </div>
  );
}

function AuditPanel({ label, bgColor, inkColor, L, accent, line, muted, border }) {
  return (
    <div style={{
      padding: "34px 28px 30px",
      background: bgColor,
      borderLeft: border ? `1px solid ${line}` : "none",
      display: "flex", flexDirection: "column", gap: 20,
      minHeight: 180,
    }}>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 9, color: muted, letterSpacing: "0.18em",
        textTransform: "uppercase", fontWeight: 600,
      }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
        <L ink={inkColor} accent={accent} size={36} variant="wordmark" />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: "auto" }}>
        <L ink={inkColor} accent={accent} size={44} variant="monogram" />
        <L ink={inkColor} accent={accent} size={44} variant="symbol" />
      </div>
    </div>
  );
}

function MiniLabel({ muted, children }) {
  return (
    <div style={{
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 9, color: muted, letterSpacing: "0.14em",
      textTransform: "uppercase", marginBottom: 10, fontWeight: 600,
    }}>
      {children}
    </div>
  );
}

// ---- Mockups ----

function MockHeader({ L, ink, accent, line, muted, cardBg }) {
  return (
    <MockFrame label="Header do site" muted={muted} line={line}>
      <div style={{
        background: cardBg, border: `1px solid ${line}`,
        padding: "14px 18px 12px",
        display: "flex", flexDirection: "column", gap: 12,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ transform: "scale(0.8)", transformOrigin: "left center" }}>
            <L ink={ink} accent={accent} size={28} variant="wordmark" />
          </div>
          <div style={{
            display: "flex", gap: 12,
            fontFamily: '"Inter", sans-serif', fontSize: 10,
            color: ink, opacity: 0.85,
          }}>
            <span>início</span>
            <span style={{ color: accent, fontWeight: 600 }}>escritos</span>
            <span>vídeos</span>
          </div>
        </div>
        <div style={{ height: 1, background: line, opacity: 0.6 }} />
        <div style={{
          fontFamily: '"Source Serif 4", serif',
          fontSize: 11, color: ink, lineHeight: 1.4, opacity: 0.85,
        }}>
          Um hub pessoal. Escrevo sobre software, leio sobre o resto.
        </div>
      </div>
    </MockFrame>
  );
}

function MockAvatar({ L, ink, accent, line, muted }) {
  return (
    <MockFrame label="Avatar redondo · YouTube/Instagram" muted={muted} line={line}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "6px 0",
      }}>
        <div style={{
          width: 104, height: 104, borderRadius: "50%",
          background: "#F5EDD8",
          border: `2px solid ${line}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}>
          <L ink={ink} accent={accent} size={66} variant="monogram" />
        </div>
        <div style={{
          fontFamily: '"Inter", sans-serif', fontSize: 11,
          color: ink, fontWeight: 600, marginTop: 2,
        }}>
          Thiago Figueiredo
        </div>
        <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
          color: muted, marginTop: -4, opacity: 0.7,
        }}>
          @thiagofigueiredo · 2.4k inscritos
        </div>
      </div>
    </MockFrame>
  );
}

function MockBrowser({ L, ink, accent, line, muted, cardBg }) {
  return (
    <MockFrame label="Tab do browser · favicon 16px" muted={muted} line={line}>
      {/* Browser chrome */}
      <div style={{
        background: "#D8CFB9", padding: "6px 6px 0",
        borderTopLeftRadius: 4, borderTopRightRadius: 4,
      }}>
        <div style={{
          background: cardBg,
          borderTopLeftRadius: 6, borderTopRightRadius: 6,
          padding: "8px 10px 10px",
          display: "flex", alignItems: "center", gap: 8,
          width: "80%",
          boxShadow: "0 -1px 0 rgba(0,0,0,0.08) inset",
        }}>
          <div style={{ width: 14, height: 14, flexShrink: 0 }}>
            <L ink={ink} accent={accent} size={14} variant="symbol" />
          </div>
          <span style={{
            fontFamily: '"Inter", sans-serif', fontSize: 10,
            color: ink, opacity: 0.85, whiteSpace: "nowrap",
          }}>
            bythiago.com
          </span>
          <span style={{
            marginLeft: "auto", fontSize: 10, color: muted, opacity: 0.5,
          }}>
            ×
          </span>
        </div>
      </div>
      {/* URL bar */}
      <div style={{
        background: cardBg,
        padding: "8px 10px",
        borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
        borderTop: `1px solid ${line}`,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span style={{ fontSize: 10, color: muted, opacity: 0.6 }}>🔒</span>
        <span style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
          color: ink, opacity: 0.75,
        }}>
          bythiago.com/escritos
        </span>
      </div>
      {/* Favicon sizes preview */}
      <div style={{
        marginTop: 14, display: "flex", gap: 14, justifyContent: "center",
        alignItems: "flex-end",
      }}>
        {[16, 32, 48].map((s) => (
          <div key={s} style={{ textAlign: "center" }}>
            <L ink={ink} accent={accent} size={s} variant="symbol" />
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 8,
              color: muted, marginTop: 6, opacity: 0.6,
            }}>
              {s}px
            </div>
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

function MockWatermark({ L, ink, accent, line, muted }) {
  return (
    <MockFrame label="Watermark · PDF/slide" muted={muted} line={line}>
      <div style={{
        background: "#FBF6E6",
        padding: "12px 14px",
        display: "flex", flexDirection: "column",
        minHeight: 158, border: `1px solid ${line}`,
      }}>
        <div style={{
          fontFamily: '"Source Serif 4", serif',
          fontSize: 9, color: "#2A2418", lineHeight: 1.5, flex: 1,
        }}>
          <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 6 }}>
            Relatório Anual · 2026
          </div>
          <div style={{ opacity: 0.75 }}>
            O ano foi de descoberta lenta: publiquei menos, li mais,
            escrevi com mais tempo entre rascunho e publicação. Este
            documento compila o que aprendi.
          </div>
        </div>
        <div style={{
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px dashed #C4B79A`,
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-end",
        }}>
          <div style={{ transform: "scale(0.6)", transformOrigin: "left bottom" }}>
            <L ink="#2A2418" accent={accent} size={24} variant="wordmark" />
          </div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 8,
            color: "#2A2418", opacity: 0.55,
          }}>
            p. 12 · 2026
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

function MockEmail({ L, ink, accent, line, muted, cardBg }) {
  return (
    <MockFrame label="Assinatura de email" muted={muted} line={line}>
      <div style={{
        background: cardBg, padding: "14px 16px",
        border: `1px solid ${line}`,
        display: "flex", flexDirection: "column", gap: 10,
        minHeight: 158,
      }}>
        <div style={{
          fontFamily: '"Source Serif 4", serif',
          fontSize: 11, color: ink, lineHeight: 1.55, opacity: 0.85,
        }}>
          Obrigado pelo contato. Aviso quando o próximo ensaio sair.
          <br /><br />
          Abraço,
        </div>
        <div style={{
          paddingTop: 10, borderTop: `1px solid ${line}`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <L ink={ink} accent={accent} size={28} variant="monogram" />
          <div style={{ lineHeight: 1.35 }}>
            <div style={{
              fontFamily: '"Source Serif 4", serif',
              fontSize: 12, fontWeight: 600, color: ink,
            }}>
              Thiago Figueiredo
            </div>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
              color: muted, opacity: 0.85,
            }}>
              bythiago.com · @thiagofigueiredo
            </div>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

function MockMerch({ L, ink, accent, line, muted }) {
  // T-shirt (fabric color)
  return (
    <MockFrame label="Camiseta · bolso esquerdo" muted={muted} line={line}>
      <div style={{
        background: "#2A2418",
        minHeight: 158,
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
        border: `1px solid ${line}`,
      }}>
        {/* shirt outline faint */}
        <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.15 }}>
          <path
            d="M 20 30 L 30 15 L 40 18 Q 50 25 60 18 L 70 15 L 80 30 L 75 40 L 70 38 L 70 85 L 30 85 L 30 38 L 25 40 Z"
            fill="none" stroke="#FAF6ED" strokeWidth="0.8"
          />
        </svg>
        {/* Logo on left chest */}
        <div style={{
          position: "absolute", top: "38%", left: "32%",
        }}>
          <L ink="#FAF6ED" accent={accent} size={26} variant="symbol" />
        </div>
      </div>
    </MockFrame>
  );
}

function MockFrame({ label, children, muted, line }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 9, color: muted, letterSpacing: "0.14em",
        textTransform: "uppercase", fontWeight: 600,
      }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

window.Logos = Logos;
