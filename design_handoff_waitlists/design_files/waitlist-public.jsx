/*
 * Waitlist — public surfaces (single opt-in).
 * Pinboard/Marginalia aesthetic, reusing window.makePinboardTheme/Kit + Brand + PageHeader.
 * One <WaitlistForm> drives every state; surfaces compose it.
 *   Surface 1 — hosted landing (full + every state as a labeled frame)
 *   Surface 2 — embeddable block (iframe card)
 *   Surface 3 — inline node inside a blog post (+ TipTap editor inset)
 */

const WLP_STATES = ["idle", "submitting", "success", "duplicate", "closed", "launched", "error", "rateLimited", "unavailable"];

function wlpStrings(L, product) {
  const name = product["name_" + L];
  const opens = product["opens_" + L];
  return L === "pt" ? {
    eyebrow: "lista de espera",
    formTitle: "Entre na lista",
    formSub: `Avisamos por email quando ${name} for lançado — ${opens}.`,
    emailLabel: "Seu email",
    emailPh: "voce@email.com",
    consent: ["Quero ser avisado(a) por email quando ", " for lançado. Posso cancelar quando quiser."],
    cta: "Quero ser avisado",
    submitting: "enviando…",
    captcha: "Verificação de segurança",
    captchaSub: "protegido por Turnstile",
    trust: ["✦ um único email", "✕ sem preço, sem venda", "↗ 1 clique pra sair"],
    terms: "Termos", privacy: "Privacidade",
    // states
    successKick: "pronto!",
    successTitle: "Você está na lista.",
    successBody: "Te avisamos assim que lançar. Enviaremos um único email — cancele quando quiser.",
    dupKick: "tudo certo",
    dupTitle: "Você já está na lista.",
    dupBody: "Seu email já estava aqui. Não precisa fazer nada — o aviso chega quando lançar.",
    closedKick: "encerrado",
    closedTitle: "As inscrições estão encerradas.",
    closedBody: "A lista de espera fechou por enquanto. Fica de olho no site — quando reabrir, volta aqui.",
    launchedKick: "já saiu",
    launchedTitle: "Já lançou!",
    launchedBody: `${name} está no ar. O aviso foi pra quem entrou na lista.`,
    errTitle: "Algo deu errado.",
    errBody: "Não consegui te inscrever agora. Tenta de novo?",
    errRetry: "tentar de novo",
    rateTitle: "Muitas tentativas.",
    rateBody: "Aguarde um instante antes de tentar de novo.",
    unavailTitle: "Temporariamente indisponível.",
    unavailBody: "Estou com um problema momentâneo. Tenta em instantes.",
    again: "inscrever outro email",
    footerNote: "Sem spam. Sem preço escondido. Só um aviso quando lançar.",
    backHome: "voltar pra home",
  } : {
    eyebrow: "waitlist",
    formTitle: "Join the waitlist",
    formSub: `We'll email you when ${name} launches — ${opens}.`,
    emailLabel: "Your email",
    emailPh: "you@email.com",
    consent: ["Notify me by email when ", " launches. I can unsubscribe anytime."],
    cta: "Notify me",
    submitting: "sending…",
    captcha: "Security check",
    captchaSub: "protected by Turnstile",
    trust: ["✦ a single email", "✕ no price, no pitch", "↗ 1-click leave"],
    terms: "Terms", privacy: "Privacy",
    successKick: "done!",
    successTitle: "You're on the list.",
    successBody: "We'll email you the moment it launches. One email only — unsubscribe anytime.",
    dupKick: "all set",
    dupTitle: "You're already on the list.",
    dupBody: "Your email was already here. Nothing to do — the heads-up arrives at launch.",
    closedKick: "closed",
    closedTitle: "Signups are closed.",
    closedBody: "The waitlist is closed for now. Keep an eye on the site — come back when it reopens.",
    launchedKick: "it's out",
    launchedTitle: "It launched!",
    launchedBody: `${name} is live. The heads-up went to everyone on the list.`,
    errTitle: "Something went wrong.",
    errBody: "Couldn't sign you up just now. Try again?",
    errRetry: "try again",
    rateTitle: "Too many attempts.",
    rateBody: "Please wait a moment before trying again.",
    unavailTitle: "Temporarily unavailable.",
    unavailBody: "I'm having a brief hiccup. Try again shortly.",
    again: "sign up another email",
    footerNote: "No spam. No hidden price. Just a heads-up at launch.",
    backHome: "back to home",
  };
}

/* ---------- small bits ---------- */
function TurnstileSlot({ theme, accent, L, S, challenge, interactive }) {
  const { dark, line, ink, muted, faint } = theme;
  const [st, setSt] = React.useState(interactive ? "idle" : (challenge ? "done" : "spin"));
  React.useEffect(() => { if (!interactive) setSt(challenge ? "done" : "spin"); }, [challenge, interactive]);
  const verify = () => { if (!interactive || st !== "idle") return; setSt("spin"); setTimeout(() => setSt("done"), 750); };
  const clickable = interactive && st === "idle";
  const boxBorder = st === "done" ? accent : faint;
  return (
    <div role={clickable ? "button" : undefined} tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? (L === "pt" ? "Verificar — proteção Turnstile" : "Verify — Turnstile protection") : undefined}
      onClick={verify}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); verify(); } } : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 11,
        padding: "11px 13px", marginBottom: 14,
        background: dark ? "rgba(0,0,0,0.22)" : "rgba(0,0,0,0.03)",
        border: `1px solid ${clickable ? accent + "66" : line}`,
        cursor: clickable ? "pointer" : "default",
      }}>
      <div style={{
        width: 20, height: 20, flexShrink: 0, borderRadius: 4,
        border: `1.5px solid ${boxBorder}`,
        background: st === "done" ? accent : "transparent",
        display: "grid", placeItems: "center", position: "relative",
      }}>
        {st === "done"
          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          : st === "spin"
            ? <span style={{ width: 11, height: 11, borderRadius: "50%", border: `2px solid ${faint}`, borderTopColor: "transparent", display: "block", animation: "wlpSpin 0.9s linear infinite" }} />
            : null}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: ink, fontWeight: 500 }}>{S.captcha}</div>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: clickable ? accent : faint, letterSpacing: "0.06em", marginTop: 1 }}>
          {clickable ? (L === "pt" ? "clique para verificar" : "click to verify") : S.captchaSub}
        </div>
      </div>
      <svg width="22" height="22" viewBox="0 0 24 24" style={{ flexShrink: 0, opacity: 0.7 }}>
        <path d="M12 3 4 7v5c0 4.5 3.2 7.6 8 9 4.8-1.4 8-4.5 8-9V7l-8-4z" fill="none" stroke={faint} strokeWidth="1.6"/>
      </svg>
    </div>
  );
}

function MsgBlock({ kick, title, body, accent, theme, tone, focusOnMount, children }) {
  const { ink, muted, hand } = theme;
  const kickColor = tone === "neutral" ? muted : accent;
  const ref = React.useRef(null);
  React.useEffect(() => { if (focusOnMount && ref.current) ref.current.focus({ preventScroll: true }); }, [focusOnMount]);
  return (
    <div ref={ref} role="status" aria-live="polite" tabIndex={-1} style={{ padding: "30px 26px 26px", outline: "none" }}>
      <div style={{ ...hand, fontSize: 46, color: kickColor, lineHeight: 0.8, marginBottom: 10, transform: "rotate(-3deg)", display: "inline-block" }}>
        {tone === "success" ? "✓ " : ""}{kick}
      </div>
      <h3 style={{ fontFamily: '"Fraunces", serif', fontSize: 26, margin: "6px 0 12px", fontWeight: 500, letterSpacing: "-0.01em", color: ink, lineHeight: 1.15 }}>
        {title}
      </h3>
      <p style={{ fontSize: 14.5, color: muted, lineHeight: 1.6, margin: 0 }}>{body}</p>
      {children}
    </div>
  );
}

/* ============================================================
   WAITLIST FORM — drives every state. `state` forces the view.
   variant: "landing" | "embed" | "inline"
   ============================================================ */
function WaitlistForm({ state = "idle", accent, theme, L, product, variant = "landing", interactive, onState }) {
  const { dark, paper, ink, muted, faint, line, marker, hand } = theme;
  const S = wlpStrings(L, product);
  const [email, setEmail] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const name = product["name_" + L];

  const isMsg = ["success", "duplicate", "closed", "launched"].includes(state);
  const isErr = ["error", "rateLimited", "unavailable"].includes(state);
  const showForm = state === "idle" || state === "submitting" || isErr;
  const loading = state === "submitting";

  const onSubmit = (e) => {
    e.preventDefault();
    if (!interactive) return;
    if (!email.includes("@") || !consent) return;
    onState && onState("submitting");
    setTimeout(() => {
      const v = email.toLowerCase();
      if (v.includes("dup")) onState && onState("duplicate");
      else if (v.includes("blocked")) onState && onState("rateLimited");
      else if (v.includes("erro") || v.includes("fail")) onState && onState("error");
      else onState && onState("success");
    }, 1100);
  };

  const reset = () => { setEmail(""); setConsent(false); onState && onState("idle"); };

  // ---- message states (replace form) ----
  if (state === "success") return (
    <MsgBlock tone="success" focusOnMount={interactive} kick={S.successKick} title={S.successTitle} body={S.successBody} accent={accent} theme={theme}>
      <ExpectationLine theme={theme} accent={accent} L={L} />
      {interactive && <ResetBtn theme={theme} line={line} label={S.again} onClick={reset} />}
      <EndMark accent={accent} theme={theme} />
    </MsgBlock>
  );
  if (state === "duplicate") return (
    <MsgBlock tone="success" focusOnMount={interactive} kick={S.dupKick} title={S.dupTitle} body={S.dupBody} accent={accent} theme={theme}>
      <ExpectationLine theme={theme} accent={accent} L={L} />
      {interactive && <ResetBtn theme={theme} line={line} label={S.again} onClick={reset} />}
      <EndMark accent={accent} theme={theme} />
    </MsgBlock>
  );
  if (state === "closed") return <MsgBlock tone="neutral" kick={S.closedKick} title={S.closedTitle} body={S.closedBody} accent={accent} theme={theme} />;
  if (state === "launched") return (
    <MsgBlock tone="success" kick={S.launchedKick} title={S.launchedTitle} body={S.launchedBody} accent={accent} theme={theme}>
      <a href="#" onClick={e => e.preventDefault()} style={{
        display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16,
        padding: "10px 16px", background: accent, color: "#FFF", textDecoration: "none",
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.14em",
        textTransform: "uppercase", fontWeight: 700,
      }}>{product["launchedLink_" + L]}</a>
    </MsgBlock>
  );

  // ---- form states ----
  const disabled = loading || !email.includes("@") || !consent;
  const errMsg = state === "error" ? [S.errTitle, S.errBody] : state === "rateLimited" ? [S.rateTitle, S.rateBody] : state === "unavailable" ? [S.unavailTitle, S.unavailBody] : null;

  return (
    <form onSubmit={onSubmit} style={{ padding: variant === "embed" ? "22px 22px 20px" : "26px 26px 24px", position: "relative" }}>
      {variant !== "inline" && (
        <div style={{ marginBottom: 12 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "4px 10px", whiteSpace: "nowrap",
            background: accent + "22", fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            letterSpacing: "0.18em", textTransform: "uppercase", color: accent, fontWeight: 700,
          }}>
            ✦ {S.eyebrow}
          </span>
        </div>
      )}
      <h3 style={{
        fontFamily: '"Fraunces", serif', fontSize: variant === "embed" ? 23 : 26, margin: "0 0 6px",
        fontWeight: 500, letterSpacing: "-0.01em", color: ink, lineHeight: 1.15,
        position: "relative", display: "inline-block",
      }}>
        {S.formTitle}
        <span style={{ position: "absolute", bottom: 2, left: -4, right: -4, height: 11, background: marker, zIndex: -1, opacity: 0.5, transform: "skew(-2deg)" }} />
      </h3>
      <p style={{ fontSize: 13, color: muted, margin: "0 0 18px", lineHeight: 1.45 }}>{S.formSub}</p>

      {/* email */}
      <label style={{ display: "block", marginBottom: 12 }}>
        <span style={{ display: "block", fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: muted, marginBottom: 5 }}>{S.emailLabel}</span>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={S.emailPh} disabled={loading}
          inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          required maxLength={320} aria-label={S.emailLabel} aria-invalid={isErr ? "true" : "false"} name="email"
          style={{
            width: "100%", padding: "12px 13px", border: `1.5px solid ${isErr ? "#C14513" : line}`,
            background: dark ? "rgba(0,0,0,0.25)" : "#FFF", color: ink,
            fontFamily: '"JetBrains Mono", monospace', fontSize: 13, outline: "none",
          }}
          onFocus={e => e.target.style.borderColor = accent}
          onBlur={e => e.target.style.borderColor = isErr ? "#C14513" : line} />
      </label>

      {/* consent — immediately under email */}
      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.5, color: muted, cursor: "pointer", marginBottom: 14 }}>
        <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required disabled={loading} style={{ marginTop: 2, accentColor: accent, flexShrink: 0, width: 16, height: 16, cursor: "pointer" }} />
        <span>{S.consent[0]}<strong style={{ color: ink }}>{name}</strong>{S.consent[1]}</span>
      </label>

      {/* turnstile slot */}
      <TurnstileSlot theme={theme} accent={accent} L={L} S={S} challenge={state === "idle"} interactive={interactive} />

      {/* error banner */}
      {errMsg && (
        <div role="alert" style={{
          padding: "11px 13px", marginBottom: 14,
          background: state === "rateLimited" ? "rgba(217,164,65,0.12)" : "rgba(193,69,19,0.1)",
          borderLeft: `3px solid ${state === "rateLimited" ? "#D9A441" : "#C14513"}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: ink, marginBottom: 2 }}>{errMsg[0]}</div>
          <div style={{ fontSize: 12.5, color: muted, lineHeight: 1.45 }}>{errMsg[1]}</div>
        </div>
      )}

      <button type="submit" disabled={disabled} aria-busy={loading ? "true" : "false"} style={{
        width: "100%", padding: "15px 22px",
        background: disabled ? (dark ? "#3A2E1F" : "#D8C9A7") : accent,
        color: disabled ? faint : "#FFF", border: "none",
        fontFamily: '"JetBrains Mono", monospace', fontSize: 12, letterSpacing: "0.16em",
        textTransform: "uppercase", fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        {loading
          ? <><span style={{ width: 12, height: 12, borderRadius: "50%", border: "2px solid currentColor", borderTopColor: "transparent", display: "inline-block", animation: "wlpSpin 0.9s linear infinite" }} /> {S.submitting}</>
          : isErr ? <>↻ {S.errRetry}</> : <>{S.cta} →</>}
      </button>

      {/* trust microcopy */}
      {variant !== "inline" && (
        <div style={{
          marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${line}`,
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6,
          fontSize: 9.5, color: faint, fontFamily: '"JetBrains Mono", monospace',
          letterSpacing: "0.04em", textAlign: "center",
        }}>
          {S.trust.map((t, i) => <div key={i}>{t}</div>)}
        </div>
      )}
    </form>
  );
}

function ExpectationLine({ theme, accent, L }) {
  return (
    <div style={{
      display: "flex", gap: 9, alignItems: "center", marginTop: 18, paddingTop: 14,
      borderTop: `1px dashed ${theme.line}`, fontSize: 12, color: theme.faint,
      fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.04em",
    }}>
      <span style={{ color: accent }}>✉</span>
      {L === "pt" ? "um único email · cancele quando quiser" : "one email only · unsubscribe anytime"}
    </div>
  );
}
function ResetBtn({ theme, line, label, onClick }) {
  return (
    <button onClick={onClick} style={{
      marginTop: 16, padding: "9px 14px", background: "transparent", color: theme.muted,
      border: `1.5px dashed ${line}`, fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
      letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
    }}>↻ {label}</button>
  );
}
function EndMark({ accent, theme }) {
  return (
    <div aria-hidden="true" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22 }}>
      <span style={{ flex: 1, height: 1, background: accent, opacity: 0.4 }} />
      <span style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: 15, color: accent, lineHeight: 1 }}>❦</span>
      <span style={{ flex: 1, height: 1, background: accent, opacity: 0.4 }} />
    </div>
  );
}

window.WaitlistForm = WaitlistForm;
window.wlpStrings = wlpStrings;
window.WLP_STATES = WLP_STATES;
window.TurnstileSlot = TurnstileSlot;
