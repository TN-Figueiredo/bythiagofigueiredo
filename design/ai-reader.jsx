/*
 * AI reader — floating button + side drawer with 3 tabs
 *   TL;DR (summary), Explain (plainer language), Chat (Q&A)
 *
 * Uses window.claude.complete. All prompts include the full plain-text
 * article as context so answers are grounded in what's actually written.
 */

const AIFloatingButton = ({ pt, theme, onClick, hidden }) => {
  if (hidden) return null;
  return (
    <button
      onClick={onClick}
      aria-label={pt.ai.open}
      style={{
        position: "fixed", right: 24, bottom: 24, zIndex: 90,
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 18px 12px 14px",
        background: theme.accent,
        color: theme.paper,
        border: "none",
        borderRadius: 999,
        fontFamily: '"Inter", sans-serif',
        fontSize: 13, fontWeight: 600,
        letterSpacing: "0.01em",
        cursor: "pointer",
        boxShadow: "0 10px 30px rgba(199,112,46,0.35), 0 2px 6px rgba(0,0,0,0.15)",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 14px 36px rgba(199,112,46,0.45), 0 3px 8px rgba(0,0,0,0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 10px 30px rgba(199,112,46,0.35), 0 2px 6px rgba(0,0,0,0.15)";
      }}
    >
      <AISparkIcon/>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1 }}>
        <span>{pt.ai.open}</span>
        <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.85, letterSpacing: "0.02em" }}>
          {pt.ai.open_sub}
        </span>
      </span>
    </button>
  );
};

const AISparkIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M12 3 L13.5 9 L19.5 10.5 L13.5 12 L12 18 L10.5 12 L4.5 10.5 L10.5 9 Z" fill={color}/>
    <path d="M18 15 L18.75 17.25 L21 18 L18.75 18.75 L18 21 L17.25 18.75 L15 18 L17.25 17.25 Z" fill={color} opacity="0.7"/>
  </svg>
);

const AIDrawer = ({ pt, theme, post, L, plainText, onClose }) => {
  const [tab, setTab] = React.useState("summary");
  const { ink, muted, accent, paper, paper2, line, bg } = theme;

  const drawerBg = paper;
  const panelBg = paper2;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        display: "flex", justifyContent: "flex-end",
        animation: "btfFadeIn 0.2s ease",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(2px)",
        }}
      />

      {/* Drawer */}
      <div
        className="ai-drawer"
        role="dialog"
        aria-label={pt.ai.title}
        style={{
          position: "relative",
          width: "min(460px, 100vw)",
          height: "100vh",
          background: drawerBg,
          color: ink,
          borderLeft: `1px solid ${line}`,
          boxShadow: "-20px 0 60px rgba(0,0,0,0.25)",
          display: "flex", flexDirection: "column",
          animation: "btfSlideIn 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: `1px solid ${line}`,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 6,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: accent, color: paper,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <AISparkIcon size={16} color={paper}/>
              </div>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 10, letterSpacing: "0.16em",
                textTransform: "uppercase", color: muted, fontWeight: 600,
              }}>
                {pt.ai.title}
              </span>
            </div>
            <h2 style={{
              margin: 0,
              fontFamily: '"Fraunces", serif',
              fontSize: 22, fontWeight: 500,
              lineHeight: 1.2,
              color: ink,
              letterSpacing: "-0.01em",
              textWrap: "balance",
            }}>
              {post["title_" + L]}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={pt.ai.close}
            style={{
              background: "transparent", border: "none",
              padding: 4, cursor: "pointer",
              color: muted, fontSize: 18, lineHeight: 1,
              marginTop: -2,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: "flex", borderBottom: `1px solid ${line}`,
          padding: "0 16px",
          background: panelBg,
        }}>
          <AITab label={pt.ai.tab_summary} active={tab === "summary"} onClick={() => setTab("summary")} theme={theme}/>
          <AITab label={pt.ai.tab_explain} active={tab === "explain"} onClick={() => setTab("explain")} theme={theme}/>
          <AITab label={pt.ai.tab_chat} active={tab === "chat"} onClick={() => setTab("chat")} theme={theme}/>
        </div>

        {/* Body */}
        <div
          className="ai-drawer"
          style={{
            flex: 1, overflowY: "auto",
            padding: "22px 24px",
          }}
        >
          {tab === "summary" && <AISummaryTab pt={pt} theme={theme} L={L} plainText={plainText} post={post}/>}
          {tab === "explain" && <AIExplainTab pt={pt} theme={theme} L={L} plainText={plainText} post={post}/>}
          {tab === "chat" && <AIChatTab pt={pt} theme={theme} L={L} plainText={plainText} post={post}/>}
        </div>

        {/* Footer disclaimer */}
        <div style={{
          padding: "10px 24px 14px",
          borderTop: `1px solid ${line}`,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: 10, letterSpacing: "0.04em",
          color: muted, background: panelBg,
          textWrap: "balance",
        }}>
          {pt.ai.powered}
        </div>
      </div>
    </div>
  );
};

const AITab = ({ label, active, onClick, theme }) => (
  <button
    onClick={onClick}
    style={{
      padding: "12px 16px",
      background: "transparent",
      border: "none",
      borderBottom: `2px solid ${active ? theme.accent : "transparent"}`,
      color: active ? theme.ink : theme.muted,
      fontFamily: '"Inter", sans-serif',
      fontSize: 13, fontWeight: active ? 600 : 500,
      cursor: "pointer",
      letterSpacing: "0.01em",
      marginBottom: -1,
      transition: "color 0.15s",
    }}
  >
    {label}
  </button>
);

// ---------- Summary Tab ----------

const AISummaryTab = ({ pt, theme, L, plainText, post }) => {
  const [result, setResult] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const { ink, muted, accent, line } = theme;

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult("");
    try {
      const langInstruction = L === "pt"
        ? "Responda em português brasileiro, mesmo tom conversacional do autor."
        : "Answer in English, matching the author's conversational tone.";
      const prompt = `${langInstruction}

You are summarizing a personal blog post. Write a TL;DR in exactly three short paragraphs:
1. The core idea in one or two sentences.
2. The key argument or "why" behind it.
3. What the reader walks away with — the practical takeaway.

Keep it tight. No bullet points. No headings. No filler.

Article:
"""
${plainText}
"""`;
      const out = await window.claude.complete(prompt);
      setResult(out);
    } catch (e) {
      console.error(e);
      setError(pt.ai.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!result && !loading && (
        <div style={{ color: muted, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
          {pt.ai.summary_intro}
        </div>
      )}

      {!result && !loading && (
        <button onClick={run} style={primaryBtn(theme)}>
          <AISparkIcon size={14} color={theme.paper}/>
          {pt.ai.summary_cta}
        </button>
      )}

      {loading && <AILoadingLine label={pt.ai.summary_loading} theme={theme}/>}
      {error && <AIErrorBlock message={error} theme={theme}/>}

      {result && !loading && (
        <div>
          <div style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontSize: 15.5, lineHeight: 1.68, color: ink,
            whiteSpace: "pre-wrap",
          }}>
            {result}
          </div>
          <button
            onClick={run}
            style={{ ...secondaryBtn(theme), marginTop: 18 }}
          >
            ↻ {pt.ai.summary_again}
          </button>
        </div>
      )}
    </div>
  );
};

// ---------- Explain Tab ----------

const AIExplainTab = ({ pt, theme, L, plainText, post }) => {
  const [level, setLevel] = React.useState(1); // 0 = ELI5, 1 = beginner, 2 = intermediate
  const [result, setResult] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const { ink, muted, accent, line, paper2 } = theme;

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult("");
    try {
      const levelLabel = pt.ai.explain_levels[level];
      const levelDesc = [
        L === "pt"
          ? "Explique como se o leitor tivesse 5 anos. Analogias bem simples, zero jargão. Pode usar comparações com brinquedos, comida, jogos."
          : "Explain as if the reader is 5. Very simple analogies, zero jargon. Feel free to compare to toys, food, games.",
        L === "pt"
          ? "Reformule para quem nunca ouviu esses conceitos antes. Evite jargão técnico; se precisar usar um termo, explica em seguida. Mantém as ideias, simplifica a linguagem."
          : "Rephrase for someone who's never heard these concepts before. Avoid technical jargon; if you must use a term, explain it. Keep the ideas, simplify the language.",
        L === "pt"
          ? "Reformule para alguém com conhecimento geral mas sem expertise. Mantém ideias técnicas mas explica trade-offs. Mais curto que o original, mais denso."
          : "Rephrase for someone with general knowledge but no expertise. Keep technical ideas but explain trade-offs. Shorter than the original, denser.",
      ][level];

      const prompt = `${L === "pt" ? "Responda em português brasileiro." : "Answer in English."}

Rephrase this personal blog post at the "${levelLabel}" level.
${levelDesc}

Output format: 3 to 5 short paragraphs. No headings. No bullet points. No preamble like "here's a rephrasing" — just write the rephrased version directly.

Original article:
"""
${plainText}
"""`;
      const out = await window.claude.complete(prompt);
      setResult(out);
    } catch (e) {
      console.error(e);
      setError(pt.ai.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ color: muted, fontSize: 14, marginBottom: 14, lineHeight: 1.5 }}>
        {pt.ai.explain_intro}
      </div>

      {/* Level selector */}
      <div style={{
        display: "flex", gap: 6,
        padding: 4,
        background: paper2,
        borderRadius: 999,
        marginBottom: 18,
        width: "fit-content",
      }}>
        {pt.ai.explain_levels.map((lbl, i) => (
          <button
            key={i}
            onClick={() => setLevel(i)}
            style={{
              padding: "6px 14px",
              background: level === i ? theme.ink : "transparent",
              color: level === i ? theme.paper : muted,
              border: "none",
              borderRadius: 999,
              fontFamily: '"Inter", sans-serif',
              fontSize: 12, fontWeight: level === i ? 600 : 500,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            {lbl}
          </button>
        ))}
      </div>

      {!result && !loading && (
        <button onClick={run} style={primaryBtn(theme)}>
          <AISparkIcon size={14} color={theme.paper}/>
          {pt.ai.explain_cta}
        </button>
      )}

      {loading && <AILoadingLine label={pt.ai.explain_loading} theme={theme}/>}
      {error && <AIErrorBlock message={error} theme={theme}/>}

      {result && !loading && (
        <div>
          <div style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontSize: 15.5, lineHeight: 1.68, color: ink,
            whiteSpace: "pre-wrap",
          }}>
            {result}
          </div>
          <button
            onClick={run}
            style={{ ...secondaryBtn(theme), marginTop: 18 }}
          >
            ↻ {L === "pt" ? "Gerar de novo" : "Generate again"}
          </button>
        </div>
      )}
    </div>
  );
};

// ---------- Chat Tab ----------

const AIChatTab = ({ pt, theme, L, plainText, post }) => {
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const { ink, muted, accent, line, paper, paper2 } = theme;
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);

    try {
      const system = L === "pt"
        ? `Você é um assistente que responde perguntas SOMENTE sobre o artigo abaixo. Se a pergunta não for respondida no texto, diga "o texto não fala sobre isso" honestamente. Responda em português, conversacional, direto. Máximo 3 parágrafos curtos.

ARTIGO:
"""
${plainText}
"""`
        : `You are an assistant that answers questions ONLY about the article below. If the question isn't answered in the text, honestly say "the text doesn't cover that". Answer in English, conversational, direct. Max 3 short paragraphs.

ARTICLE:
"""
${plainText}
"""`;

      const out = await window.claude.complete({
        messages: [
          { role: "user", content: system + "\n\n---\n\nFirst question: " + history[0].content },
          ...history.slice(1).map(m => ({ role: m.role, content: m.content })),
          ...(history.length === 1 ? [] : [{ role: "user", content: text }]),
        ].filter((m, i, arr) => arr.findIndex(x => x.content === m.content && x.role === m.role) === i),
      });
      setMessages([...history, { role: "assistant", content: out }]);
    } catch (e) {
      console.error(e);
      setMessages([...history, { role: "assistant", content: pt.ai.error, error: true }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: "auto", paddingBottom: 12, minHeight: 0 }}
      >
        {messages.length === 0 && (
          <div>
            <div style={{ color: muted, fontSize: 14, marginBottom: 16, lineHeight: 1.5 }}>
              {pt.ai.chat_intro}
            </div>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
              color: muted, marginBottom: 10, fontWeight: 600,
            }}>
              {L === "pt" ? "Sugestões" : "Suggestions"}
            </div>
            {pt.ai.chat_suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "12px 14px",
                  marginBottom: 8,
                  background: paper2,
                  border: `1px solid ${line}`,
                  borderRadius: 10,
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontSize: 14, color: ink,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = accent;
                  e.currentTarget.style.background = paper;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = line;
                  e.currentTarget.style.background = paper2;
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <ChatBubble key={i} msg={m} theme={theme}/>
        ))}

        {loading && (
          <div style={{
            display: "flex", gap: 6, alignItems: "center",
            color: muted, fontSize: 13,
            padding: "8px 0",
          }}>
            <span style={{ animation: "btfPulse 1.2s ease-in-out infinite" }}>●</span>
            <span style={{ animation: "btfPulse 1.2s ease-in-out infinite 0.2s" }}>●</span>
            <span style={{ animation: "btfPulse 1.2s ease-in-out infinite 0.4s" }}>●</span>
            <span style={{ marginLeft: 8, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.08em" }}>
              {pt.ai.chat_loading}
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        style={{
          display: "flex", gap: 8, paddingTop: 14,
          borderTop: `1px solid ${line}`, marginTop: 12,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={pt.ai.chat_placeholder}
          disabled={loading}
          style={{
            flex: 1,
            padding: "10px 14px",
            background: paper2,
            border: `1px solid ${line}`,
            borderRadius: 999,
            fontFamily: '"Inter", sans-serif',
            fontSize: 13, color: ink,
            outline: "none",
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = accent}
          onBlur={(e) => e.currentTarget.style.borderColor = line}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: "10px 16px",
            background: input.trim() && !loading ? accent : paper2,
            color: input.trim() && !loading ? paper : muted,
            border: "none",
            borderRadius: 999,
            fontFamily: '"Inter", sans-serif',
            fontSize: 13, fontWeight: 600,
            cursor: input.trim() && !loading ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}
        >
          {pt.ai.chat_send}
        </button>
      </form>
    </div>
  );
};

const ChatBubble = ({ msg, theme }) => {
  const { ink, muted, accent, paper, paper2, line } = theme;
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 12,
    }}>
      <div style={{
        maxWidth: "85%",
        padding: "10px 14px",
        background: isUser ? paper2 : "transparent",
        border: isUser ? `1px solid ${line}` : "none",
        borderRadius: 14,
        borderTopRightRadius: isUser ? 4 : 14,
        borderTopLeftRadius: isUser ? 14 : 4,
        fontFamily: isUser ? '"Inter", sans-serif' : '"Source Serif 4", Georgia, serif',
        fontSize: isUser ? 13.5 : 15,
        lineHeight: 1.55,
        color: msg.error ? "#B85a3a" : ink,
        whiteSpace: "pre-wrap",
        textWrap: "pretty",
      }}>
        {!isUser && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            marginBottom: 6,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
            color: accent, fontWeight: 600,
          }}>
            <AISparkIcon size={10} color={accent}/>
            AI
          </div>
        )}
        {msg.content}
      </div>
    </div>
  );
};

// ---------- Shared bits ----------

const AILoadingLine = ({ label, theme }) => (
  <div style={{
    display: "flex", gap: 6, alignItems: "center",
    color: theme.muted, fontSize: 13,
    padding: "12px 0",
  }}>
    <span style={{ animation: "btfPulse 1.2s ease-in-out infinite" }}>●</span>
    <span style={{ animation: "btfPulse 1.2s ease-in-out infinite 0.2s" }}>●</span>
    <span style={{ animation: "btfPulse 1.2s ease-in-out infinite 0.4s" }}>●</span>
    <span style={{ marginLeft: 8, fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.08em" }}>
      {label}
    </span>
  </div>
);

const AIErrorBlock = ({ message, theme }) => (
  <div style={{
    padding: "12px 14px",
    background: "rgba(184,90,58,0.08)",
    border: "1px solid rgba(184,90,58,0.3)",
    borderRadius: 8,
    color: "#B85a3a",
    fontSize: 13,
    fontFamily: '"Inter", sans-serif',
  }}>
    {message}
  </div>
);

const primaryBtn = (theme) => ({
  display: "inline-flex", alignItems: "center", gap: 8,
  padding: "10px 18px",
  background: theme.accent,
  color: theme.paper,
  border: "none",
  borderRadius: 999,
  fontFamily: '"Inter", sans-serif',
  fontSize: 13, fontWeight: 600,
  letterSpacing: "0.01em",
  cursor: "pointer",
  transition: "filter 0.15s",
});

const secondaryBtn = (theme) => ({
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "8px 14px",
  background: "transparent",
  color: theme.muted,
  border: `1px solid ${theme.line}`,
  borderRadius: 999,
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer",
  transition: "all 0.15s",
});

Object.assign(window, {
  AIFloatingButton, AIDrawer,
});
