/*
 * Post page — reads ?slug= from URL, renders a single article with
 * sticky TOC, progress bar, share menu, author card, series nav,
 * related posts, inline newsletter, comments mock, and a colophon.
 *
 * Reuses the Pinboard theme + kit from shared.jsx.
 */

const PostPage = ({ t, dark, content, adsConfig }) => {
  const [copied, setCopied] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [activeH, setActiveH] = React.useState(null);
  // Footnote popover on hover
  const [fnPopover, setFnPopover] = React.useState(null);
  // Engagement state — persists across refresh in localStorage
  const [liked, setLiked] = React.useState(false);
  const [bookmarked, setBookmarked] = React.useState(false);
  const [viewCount, setViewCount] = React.useState(0);const [aiOpen, setAiOpen] = React.useState(false);

  const L = window._lang;
  const C = content;
  const pt = t.post;
  const theme = window.makePinboardTheme(dark);
  const kit = window.makePinboardKit(theme);
  const { PageHeader, WritingCard, Paper, Tape } = kit;
  const { bg, ink, muted, faint, line, accent, marker, hand, paper, paper2 } = theme;

  // ---- Resolve which post ----
  const slug = React.useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("slug") || "manifesto-bythiagofigueiredo";
  }, []);
  const post = C.posts.find((p) => p.slug === slug) || C.posts[0];
  const bodyEntry = C.postBodies[post.slug] || {};
  const body = bodyEntry[L] || [];
  const footnotes = (bodyEntry.footnotes || {})[L] || [];
  const cat = C.categories[post.cat];

  // Plain text for AI (strip HTML tags, flatten headings + paragraphs)
  const plainText = React.useMemo(() => {
    const strip = (s) => String(s || "").replace(/<[^>]+>/g, "");
    const lines = [`# ${post["title_" + L]}`, post["excerpt_" + L], ""];
    body.forEach((b) => {
      if (b.type === "h2" || b.type === "h3") {
        lines.push("\n## " + strip(b["text_" + L] || b.text));
      } else if (b.type === "p" || b.type === "quote" || b.type === "callout") {
        lines.push(strip(b.text));
      } else if (b.type === "list" && b.items) {
        b.items.forEach((it) => lines.push("- " + strip(it)));
      } else if (b.type === "code" && b.text) {
        lines.push("```\n" + b.text + "\n```");
      }
    });
    return lines.join("\n");
  }, [post.slug, L]);

  // ---- Highlights (persistent, per-slug+lang) ----
  const highlightsKey = `btf_hl_${post.slug}_${L}`;
  const [highlights, setHighlights] = React.useState(() => {
    try {return JSON.parse(localStorage.getItem(highlightsKey) || "[]");}
    catch {return [];}
  });
  React.useEffect(() => {
    try {localStorage.setItem(highlightsKey, JSON.stringify(highlights));}
    catch {}
  }, [highlights, highlightsKey]);
  // Reload when slug or lang changes
  React.useEffect(() => {
    try {setHighlights(JSON.parse(localStorage.getItem(highlightsKey) || "[]"));}
    catch {setHighlights([]);}}, [highlightsKey]);

  const addHighlight = (text) => {
    const clean = (text || "").trim();
    if (!clean || clean.length < 4) return;
    setHighlights((h) => {
      // dedupe
      if (h.some((x) => x.text === clean)) return h;
      return [...h, { text: clean, at: Date.now() }];
    });
  };
  const removeHighlight = (at) => {
    setHighlights((h) => h.filter((x) => x.at !== at));
  };
  const clearHighlights = () => setHighlights([]);

  // Apply highlights visually by wrapping matched text in <mark> tags
  React.useEffect(() => {
    const article = document.getElementById("article-body");
    if (!article) return;

    // First, remove any existing btf-hl marks
    article.querySelectorAll("mark.btf-hl").forEach((m) => {
      const parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });

    if (highlights.length === 0) return;

    // Walk text nodes and replace
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, null);
    const toProcess = [];
    let n;
    while (n = walker.nextNode()) {
      if (n.parentElement && n.parentElement.closest("sup.fn, .fn-back, pre, code, ol")) continue;
      toProcess.push(n);
    }

    highlights.forEach((hl) => {
      const needle = hl.text;
      if (!needle) return;
      for (let i = 0; i < toProcess.length; i++) {
        const node = toProcess[i];
        if (!node.parentNode || node.nodeType !== 3) continue;
        const text = node.nodeValue;
        const idx = text.indexOf(needle);
        if (idx === -1) continue;
        const before = text.slice(0, idx);
        const matchText = text.slice(idx, idx + needle.length);
        const after = text.slice(idx + needle.length);
        const mark = document.createElement("mark");
        mark.className = "btf-hl";
        mark.dataset.hlAt = hl.at;
        mark.textContent = matchText;
        const parent = node.parentNode;
        if (before) parent.insertBefore(document.createTextNode(before), node);
        parent.insertBefore(mark, node);
        if (after) {
          const afterNode = document.createTextNode(after);
          parent.insertBefore(afterNode, node);
          toProcess.push(afterNode);
        }
        parent.removeChild(node);
        break; // one match per highlight
      }
    });
  }, [highlights, slug, L, body.length]);

  // Selection toolbar state
  const [selTool, setSelTool] = React.useState(null); // {x, y, text} or null
  React.useEffect(() => {
    const onUp = (e) => {
      // ignore clicks on the toolbar itself
      if (e.target && e.target.closest && e.target.closest("[data-sel-toolbar]")) return;
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {setSelTool(null);return;}
        const text = sel.toString().trim();
        if (text.length < 4) {setSelTool(null);return;}
        // must be inside #article-body
        const anchor = sel.anchorNode;
        const within = anchor && (anchor.parentElement || anchor).closest && (anchor.parentElement || anchor).closest("#article-body");
        if (!within) {setSelTool(null);return;}
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelTool({
          x: rect.left + rect.width / 2,
          y: rect.top - 8,
          text
        });
      }, 10);
    };
    const onScroll = () => setSelTool(null);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // ---- Series resolution ----
  const series = post.series;
  const seriesPrev = series?.prev ? C.posts.find((p) => p.slug === series.prev) : null;
  const seriesNext = series?.next ? C.posts.find((p) => p.slug === series.next) : null;

  // ---- Headings for TOC ----
  const headings = body.
  map((b, i) => b.type === "h2" || b.type === "h3" ? { ...b, i } : null).
  filter(Boolean);

  // ---- Ad selection ----
  // Pick deterministic-but-varied ads per post slug. House ads get
  // priority on Bowtie; sponsors rotate on body slots.
  const adsCfg = adsConfig || { enabled: true, slots: { marginalia: true, anchor: true, bookmark: true, coda: true, bowtie: true, doorman: false } };
  const adsEnabled = adsCfg.enabled && window.AdsContent;
  const slot = adsCfg.slots || {};

  // Hash the slug for deterministic ad picks
  let adH = 0;
  for (let i = 0; i < post.slug.length; i++) adH = adH * 31 + post.slug.charCodeAt(i) | 0;
  const sponsorList = adsEnabled ? Object.values(window.AdsContent.sponsors) : [];
  const houseList = adsEnabled ? Object.values(window.AdsContent.houseAds) : [];
  const pickSponsor = (offset = 0) => sponsorList.length ? sponsorList[Math.abs(adH + offset) % sponsorList.length] : null;
  const pickHouse = (offset = 0) => houseList.length ? houseList[Math.abs(adH + offset) % houseList.length] : null;

  // Marginalia is a HOUSE ad by default (rail position underperforms for sponsors;
  // also avoids stacking 2 sponsors on the same scroll axis with Anchor).
  const adMarginalia = adsEnabled && slot.marginalia ? pickHouse(2) : null;
  const adAnchor = adsEnabled && slot.anchor ? pickSponsor(1) : null;
  const adBookmark = adsEnabled && slot.bookmark ? pickSponsor(2) : null;
  const adCoda = adsEnabled && slot.coda ? pickHouse(0) : null;
  const adBowtie = adsEnabled && slot.bowtie ? window.AdsContent.houseAds.newsletter || pickHouse(1) : null;
  const adDoorman = adsEnabled && slot.doorman ? pickHouse(0) : null;
  // Mobile fallback: when rails collapse (<960px), surface a compact Anchor inline.
  const adMobileInline = adsEnabled && slot.anchor ? pickSponsor(1) : null;

  // Bookmark insertion index — best practice is BEFORE next h2 (section transition),
  // not directly after one. We pick the index right BEFORE the 2nd h2 (or 1st if only one).
  // This places the ad at a natural pause between sections, when the reader is between ideas.
  const h2Indices = body.map((b, i) => b.type === "h2" ? i : -1).filter((i) => i >= 0);
  let bookmarkAfterIdx;
  if (h2Indices.length >= 3) {
    // Insert just before the 2nd h2 (i.e. after last block of section 1)
    bookmarkAfterIdx = h2Indices[1] - 1;
  } else if (h2Indices.length >= 2) {
    bookmarkAfterIdx = h2Indices[1] - 1;
  } else if (h2Indices.length === 1) {
    // Only one h2 — insert ~60% through after that h2
    bookmarkAfterIdx = Math.min(body.length - 2, h2Indices[0] + Math.floor((body.length - h2Indices[0]) * 0.6));
  } else {
    bookmarkAfterIdx = Math.floor(body.length * 0.55);
  }
  // Mobile-inline anchor insertion — at ~70% through, only for narrow screens via CSS
  const mobileInlineAfterIdx = h2Indices.length >= 2 ?
  h2Indices[h2Indices.length - 1] - 1 :
  Math.floor(body.length * 0.7);

  // ---- Related posts (same category, not this one) ----
  const related = C.posts.filter((p) => p.cat === post.cat && p.slug !== post.slug).slice(0, 3);

  // ---- Engagement state persistence ----
  const engKey = `btf_eng_${post.slug}`;
  const [likeCount, setLikeCount] = React.useState(0);
  React.useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(engKey) || "{}");
      setLiked(!!raw.liked);
      setBookmarked(!!raw.bookmarked);
      // Deterministic pseudo base so numbers look real
      let h = 0;
      for (let i = 0; i < post.slug.length; i++) h = h * 31 + post.slug.charCodeAt(i) | 0;
      const baseLikes = 80 + Math.abs(h) % 420;
      setLikeCount(baseLikes + (raw.liked ? 1 : 0));
      // Views
      const now = Date.now();
      let views = raw.views || 1200 + Math.abs(h >> 4) % 4800;
      const last = raw.lastView || 0;
      if (now - last > 30 * 60 * 1000) views += 1;
      setViewCount(views);
      localStorage.setItem(engKey, JSON.stringify({ ...raw, views, lastView: now }));
    } catch {}
  }, [post.slug]);

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try {
      const raw = JSON.parse(localStorage.getItem(engKey) || "{}");
      localStorage.setItem(engKey, JSON.stringify({ ...raw, liked: next }));
    } catch {}
  };
  const toggleBookmark = () => {
    const next = !bookmarked;
    setBookmarked(next);
    try {
      const raw = JSON.parse(localStorage.getItem(engKey) || "{}");
      localStorage.setItem(engKey, JSON.stringify({ ...raw, bookmarked: next }));
    } catch {}
  };

  // ---- Reading progress + active heading on scroll ----
  const [timeLeft, setTimeLeft] = React.useState(null);
  React.useEffect(() => {
    const onScroll = () => {
      const article = document.getElementById("article-body");
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = Math.max(0, -rect.top);
      const p = total > 0 ? Math.min(1, scrolled / total) : 0;
      setProgress(p);

      // time left estimate in minutes
      const totalMin = parseInt(post.read, 10) || 9;
      const left = Math.max(0, Math.round(totalMin * (1 - p)));
      setTimeLeft(left);

      // active heading
      const hs = article.querySelectorAll("h2[id], h3[id]");
      let active = null;
      hs.forEach((h) => {
        const r = h.getBoundingClientRect();
        if (r.top < 120) active = h.id;
      });
      setActiveH(active);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [slug, L]);

  // ---- Share ----
  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // ---- Nav config (reuse PageHeader) ----
  const nav = [
  { key: "home", href: "Pinboard.html", label: t.nav.home },
  { key: "writing", href: "blog.html", label: t.nav.writing },
  { key: "videos", href: "videos.html", label: t.nav.videos },
  { key: "newsletters", href: "newsletters.html", label: t.nav.newsletter },
  { key: "about", href: "#", label: t.nav.about }];


  // ---- Styles for body ----
  const bodyStyles = {
    fontFamily: '"Source Serif 4", Georgia, serif',
    fontSize: 19,
    lineHeight: 1.7,
    color: ink
  };

  return (
    <div id="top" style={{
      background: bg, color: ink, minHeight: "100vh",
      fontFamily: '"Inter", sans-serif'
    }}>
      {/* Reading progress bar — just below the sticky header */}
      <div style={{
        position: "fixed", top: 102, left: 0, right: 0, height: 3,
        background: "transparent", zIndex: 98,
        pointerEvents: "none"
      }}>
        <div style={{
          height: "100%", width: `${progress * 100}%`,
          background: accent, transition: "width 0.08s linear"
        }} />
      </div>

      {/* Time-left pill (appears after 8% scroll) */}
      {progress > 0.08 && progress < 0.96 && timeLeft !== null &&
      <div style={{
        position: "fixed", top: 54, right: 20, zIndex: 99,
        padding: "4px 10px",
        background: dark ? "rgba(20,17,11,0.92)" : "rgba(255,252,238,0.94)",
        color: muted, fontSize: 11, fontFamily: '"JetBrains Mono", monospace',
        letterSpacing: "0.06em", border: `1px solid ${line}`,
        pointerEvents: "none",
        backdropFilter: "blur(8px)",
        animation: "btfFadeIn 0.3s ease"
      }}>
          {timeLeft} min {pt.time_left}
        </div>
      }

      <PageHeader nav={nav} current="writing" ctas={
      <a href="newsletters.html" style={{
        padding: "7px 13px", background: marker, color: "#1A140C",
        fontSize: 12, fontWeight: 600, textDecoration: "none",
        fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.04em",
        display: "inline-block", transform: "rotate(-1deg)"
      }}>
          {L === "pt" ? "Assinar" : "Subscribe"}
        </a>
      } />

      {/* Breadcrumbs / back */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 28px 0" }}>
        <a href="blog.html" style={{
          ...hand, fontSize: 18, color: accent, textDecoration: "none",
          transform: "rotate(-1deg)", display: "inline-block"
        }}>
          {pt.back}
        </a>
      </div>

      {/* Doorman ad — banner above hero (off by default) */}
      {adDoorman && <window.Doorman ad={adDoorman} L={L} theme={theme} />}

      {/* Hero */}
      <article style={{ maxWidth: 920, margin: "0 auto", padding: "32px 28px 0" }}>

        {/* Category + date line */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <a href={`blog.html?cat=${post.cat}`} style={{ textDecoration: "none" }}>
            <span style={{
              display: "inline-block",
              padding: "4px 10px",
              fontSize: 11, letterSpacing: "0.08em",
              fontFamily: '"JetBrains Mono", monospace',
              color: cat.color, border: `1px solid ${cat.color}`,
              background: dark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.4)",
              textTransform: "uppercase", fontWeight: 600
            }}>{cat[L]}</span>
          </a>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
            color: muted, letterSpacing: "0.06em"
          }}>
            {post["date_" + L]}
            <span style={{ margin: "0 10px", opacity: 0.5 }}>·</span>
            {post.read} {pt.read_time}
            {post["updated_" + L] &&
            <>
                <span style={{ margin: "0 10px", opacity: 0.5 }}>·</span>
                <span style={{ fontStyle: "italic", opacity: 0.75 }}>
                  {pt.updated_short} {post["updated_" + L]}
                </span>
              </>
            }
          </span>
        </div>

        {/* Series banner */}
        {series &&
        <div style={{
          background: paper2, padding: "12px 16px",
          borderLeft: `3px solid ${accent}`,
          marginBottom: 24, position: "relative"
        }}>
            <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10, letterSpacing: "0.14em",
            color: muted, textTransform: "uppercase", marginBottom: 4
          }}>
              {pt.series_kicker} · {series.current} {pt.series_of} {series.total}
            </div>
            <div style={{
            fontFamily: '"Fraunces", serif',
            fontSize: 17, color: ink, fontWeight: 500
          }}>
              {series["title_" + L]}
            </div>
          </div>
        }

        {/* Title */}
        <h1 style={{
          fontFamily: '"Fraunces", "Source Serif 4", Georgia, serif',
          fontSize: "clamp(36px, 5.5vw, 64px)",
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
          color: ink, margin: "0 0 20px",
          fontWeight: 500,
          textWrap: "balance"
        }}>
          {post["title_" + L]}
        </h1>

        {/* Excerpt / dek */}
        <p style={{
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 22, lineHeight: 1.45, color: muted,
          margin: "0 0 32px",
          fontStyle: "italic", textWrap: "pretty",
          maxWidth: 720
        }}>
          {post["excerpt_" + L]}
        </p>

        {/* Author + engagement + share row */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 0", borderTop: `1px solid ${line}`, borderBottom: `1px solid ${line}`,
          marginBottom: 44, flexWrap: "wrap", gap: 16, rowGap: 14
        }}>
          <a href={`blog.html?author=${C.author.slug}`} style={{
            display: "flex", alignItems: "center", gap: 12,
            textDecoration: "none", color: "inherit"
          }}>
            <Avatar initials={C.author.avatar_initials} size={40} theme={theme} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: ink }}>
                {L === "pt" ? "por " : "by "}
                <span style={{ textDecoration: "underline", textDecorationColor: accent, textDecorationThickness: 1, textUnderlineOffset: 3 }}>
                  {C.author.name}
                </span>
              </div>
              <div style={{ fontSize: 12, color: muted }}>
                {C.author["role_" + L]}
              </div>
            </div>
          </a>

          {/* Engagement pills */}
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            fontFamily: '"JetBrains Mono", monospace'
          }}>
            {/* Views (read-only) */}
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 12px",
              fontSize: 12, color: muted,
              letterSpacing: "0.04em",
              borderRight: `1px solid ${line}`
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {viewCount.toLocaleString(L === "pt" ? "pt-BR" : "en-US")}
              </span>
              <span style={{ opacity: 0.7 }}>{pt.engagement.views}</span>
            </div>

            {/* Like */}
            <button
              onClick={toggleLike}
              aria-pressed={liked}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 12px",
                background: "transparent", border: "none",
                fontFamily: "inherit", fontSize: 12,
                letterSpacing: "0.04em",
                color: liked ? accent : muted,
                cursor: "pointer",
                transition: "color 0.15s, transform 0.15s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.03)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              title={liked ? pt.engagement.liked : pt.engagement.like}>
              
              <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {likeCount.toLocaleString(L === "pt" ? "pt-BR" : "en-US")}
              </span>
            </button>

            {/* Bookmark */}
            <button
              onClick={toggleBookmark}
              aria-pressed={bookmarked}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 12px",
                background: "transparent", border: "none",
                fontFamily: "inherit", fontSize: 12,
                letterSpacing: "0.04em",
                color: bookmarked ? accent : muted,
                cursor: "pointer",
                transition: "color 0.15s, transform 0.15s",
                textTransform: "uppercase",
                fontWeight: 600
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.03)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              title={bookmarked ? pt.engagement.bookmarked : pt.engagement.bookmark}>
              
              <svg width="13" height="13" viewBox="0 0 24 24" fill={bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 4 L18 4 L18 21 L12 17 L6 21 Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{bookmarked ? pt.engagement.bookmarked : pt.engagement.bookmark}</span>
            </button>
          </div>

          <ShareRow post={post} pt={pt} theme={theme} copied={copied} onCopy={copyLink} />
        </div>

        {/* Hero image */}
        <div style={{ position: "relative", marginBottom: 48, paddingTop: 12 }}>
          <Paper tint={paper} pad="0" rotation={-0.5} y={0}>
            <Tape color={theme.tape} style={{ top: -10, left: "12%", transform: "rotate(-3deg)" }} />
            <Tape color={theme.tape2} style={{ top: -10, right: "14%", transform: "rotate(4deg)" }} />
            <div style={{ position: "relative", aspectRatio: "16/9", overflow: "hidden" }}>
              {post.heroIllustration && window.HeroIllustration ?
              <window.HeroIllustration kind={post.heroIllustration} dark={dark} accent={accent} /> :

              <>
                  <div style={{
                  position: "absolute", inset: 0,
                  ...window.postImg(post.img, { dark })
                }} />
                  <div style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.3))"
                }} />
                  <div style={{
                  position: "absolute", bottom: 16, right: 20,
                  ...hand, fontSize: 18, color: "#F7EEDA",
                  transform: "rotate(-2deg)",
                  textShadow: "0 1px 4px rgba(0,0,0,0.4)"
                }}>
                    {L === "pt" ? "foto de capa" : "cover image"}
                  </div>
                </>
              }
            </div>
          </Paper>
        </div>
      </article>

      {/* Two-column: TOC + body */}
      <div className="post-layout" style={{
        maxWidth: 1280, margin: "0 auto",
        padding: "0 28px 80px",
        display: "grid", gridTemplateColumns: "200px minmax(0, 720px) 200px",
        gap: 48, justifyContent: "center"
      }}>

        {/* Left: sticky TOC */}
        <aside style={{ position: "relative" }}>
          <div style={{ position: "sticky", top: 120 }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10, letterSpacing: "0.16em",
              color: muted, textTransform: "uppercase", fontWeight: 600,
              marginBottom: 14
            }}>
              {pt.toc_title}
            </div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {headings.map((h) => {
                const label = h.type === "h2" ? h["text_" + L] || h.text : h["text_" + L] || h.text;
                const active = activeH === h.id;
                return (
                  <a key={h.i} href={`#${h.id}`} style={{
                    fontSize: h.type === "h2" ? 13 : 12,
                    color: active ? ink : muted,
                    fontWeight: active ? 600 : 400,
                    textDecoration: "none",
                    padding: "5px 0 5px 12px",
                    borderLeft: `2px solid ${active ? accent : "transparent"}`,
                    paddingLeft: h.type === "h3" ? 22 : 12,
                    lineHeight: 1.35,
                    transition: "all 0.15s"
                  }}>
                    {label}
                  </a>);

              })}
            </nav>

            {/* Share vertical (appears mid-read) */}
            <div style={{ marginTop: 36, paddingTop: 20, borderTop: `1px dashed ${line}` }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 10, letterSpacing: "0.16em",
                color: muted, textTransform: "uppercase", fontWeight: 600,
                marginBottom: 10
              }}>
                {pt.share}
              </div>
              <ShareRow post={post} pt={pt} theme={theme} copied={copied} onCopy={copyLink} vertical />
            </div>

            {/* Marginalia ad — left rail */}
            {adMarginalia && <window.Marginalia ad={adMarginalia} L={L} theme={theme} />}

            {/* Back to top */}
            {progress > 0.3 &&
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              style={{
                marginTop: 24, padding: "8px 0", background: "transparent",
                border: "none", color: accent,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                letterSpacing: "0.1em", textTransform: "uppercase",
                cursor: "pointer", textAlign: "left",
                opacity: 0, animation: "btfFadeIn 0.3s ease forwards"
              }}>
              
                {pt.back_to_top}
              </button>
            }
          </div>
        </aside>

        {/* Center: body */}
        <article
          id="article-body"
          style={bodyStyles}
          onMouseOver={(e) => {
            const sup = e.target.closest("sup.fn[data-fn]");
            if (sup) {
              const n = parseInt(sup.dataset.fn, 10);
              const fn = footnotes[n - 1];
              if (fn) {
                const rect = sup.getBoundingClientRect();
                setFnPopover({
                  n, text: fn,
                  x: rect.left + rect.width / 2,
                  y: rect.top
                });
              }
            }
          }}
          onMouseOut={(e) => {
            const sup = e.target.closest("sup.fn[data-fn]");
            const to = e.relatedTarget;
            if (sup && (!to || !to.closest || !to.closest("sup.fn[data-fn]"))) {
              setFnPopover(null);
            }
          }}
          onClick={(e) => {
            const sup = e.target.closest("sup.fn[data-fn]");
            if (sup) {
              e.preventDefault();
              const n = sup.dataset.fn;
              const el = document.getElementById(`fn-${n}`);
              if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
                el.style.background = theme.marker;
                setTimeout(() => {el.style.background = "transparent";}, 1600);
              }
              return;
            }
            const back = e.target.closest("a.fn-back[data-back]");
            if (back) {
              e.preventDefault();
              const n = back.dataset.back;
              const ref = document.querySelector(`sup.fn[data-fn="${n}"]`);
              if (ref) ref.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
            const mark = e.target.closest("mark.btf-hl[data-hl-at]");
            if (mark) {
              // Allow a shift-click or double-click to remove
              if (e.shiftKey || e.detail === 2) {
                e.preventDefault();
                const at = parseInt(mark.dataset.hlAt, 10);
                if (at) removeHighlight(at);
              }
              return;
            }
          }}>
          
          {body.map((block, i) =>
          <React.Fragment key={i}>
              <Block block={block} L={L} theme={theme} />
              {adBookmark && i === bookmarkAfterIdx &&
            <window.Bookmark ad={adBookmark} L={L} theme={theme} />
            }
              {adMobileInline && i === mobileInlineAfterIdx && i !== bookmarkAfterIdx &&
            <div className="mobile-only-ad">
                  <window.Anchor ad={adMobileInline} L={L} theme={theme} />
                </div>
            }
            </React.Fragment>
          )}

          {/* End-of-article author card */}
          <div style={{ marginTop: 64, padding: "32px", background: paper, position: "relative" }}>
            <Tape color={theme.tape} style={{ top: -10, left: "8%", transform: "rotate(-3deg)" }} />
            <Tape color={theme.tape2} style={{ top: -10, right: "12%", transform: "rotate(4deg)" }} />
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10, letterSpacing: "0.14em",
              color: muted, textTransform: "uppercase", fontWeight: 600,
              marginBottom: 16
            }}>
              {pt.author_title}
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <Avatar initials={C.author.avatar_initials} size={64} theme={theme} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: '"Fraunces", serif',
                  fontSize: 22, fontWeight: 500, color: ink, marginBottom: 4
                }}>
                  {C.author.name}
                </div>
                <div style={{
                  fontSize: 12, color: muted, fontFamily: '"JetBrains Mono", monospace',
                  letterSpacing: "0.06em", marginBottom: 12
                }}>
                  {C.author["role_" + L]}
                </div>
                <p style={{
                  fontSize: 15, color: ink, lineHeight: 1.6, margin: "0 0 14px",
                  fontFamily: '"Source Serif 4", Georgia, serif'
                }}>
                  {C.author["bio_" + L]}
                </p>
                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                  {C.author.social.map((s) =>
                  <a key={s.platform} href={s.url} target="_blank" rel="noopener" style={{
                    fontSize: 12, color: muted, textDecoration: "none",
                    fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.06em",
                    borderBottom: `1px dotted ${muted}`
                  }}>
                      {s.label} ↗
                    </a>
                  )}
                  <a href={`blog.html?author=${C.author.slug}`} style={{
                    marginLeft: "auto",
                    ...hand, fontSize: 17, color: accent,
                    textDecoration: "none", transform: "rotate(-1deg)",
                    display: "inline-block"
                  }}>
                    {pt.author_more}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div style={{ marginTop: 40 }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10, letterSpacing: "0.14em",
              color: muted, textTransform: "uppercase", fontWeight: 600,
              marginBottom: 12
            }}>
              {pt.tags_title}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {post.tags.map((tag) =>
              <a key={tag} href={`blog.html?tag=${tag}`} style={{
                padding: "6px 12px",
                fontSize: 11, color: muted,
                fontFamily: '"JetBrains Mono", monospace',
                letterSpacing: "0.04em",
                border: `1px solid ${line}`,
                textDecoration: "none",
                background: "transparent"
              }}>
                  #{tag}
                </a>
              )}
            </div>
          </div>

          {/* Series — next in series */}
          {seriesNext &&
          <div style={{
            marginTop: 48, padding: "24px 28px",
            background: paper2, borderLeft: `3px solid ${accent}`,
            position: "relative"
          }}>
              <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10, letterSpacing: "0.14em",
              color: muted, textTransform: "uppercase", fontWeight: 600,
              marginBottom: 8
            }}>
                {pt.next_in_series_title}
              </div>
              <a href={`post.html?slug=${seriesNext.slug}`} style={{
              textDecoration: "none", color: "inherit",
              display: "block"
            }}>
                <div style={{
                fontFamily: '"Fraunces", serif',
                fontSize: 24, fontWeight: 500, color: ink,
                lineHeight: 1.2, marginBottom: 6
              }}>
                  {seriesNext["title_" + L]} →
                </div>
                <div style={{ fontSize: 14, color: muted, lineHeight: 1.5 }}>
                  {seriesNext["excerpt_" + L]}
                </div>
              </a>
            </div>
          }

          {/* Inline newsletter CTA — Bowtie ad slot */}
          {adBowtie ?
          <window.Bowtie ad={adBowtie} L={L} theme={theme} /> :

          <div style={{
            marginTop: 48, padding: "32px",
            background: marker, color: "#1A140C", position: "relative",
            transform: "rotate(-0.3deg)"
          }}>
            <Tape color={"rgba(255,180,120,0.8)"} style={{ top: -10, left: "40%", transform: "rotate(3deg)" }} />
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10, letterSpacing: "0.16em",
              textTransform: "uppercase", fontWeight: 600, marginBottom: 10, opacity: 0.7
            }}>
              Newsletter
            </div>
            <div style={{
              fontFamily: '"Fraunces", serif',
              fontSize: 26, fontWeight: 500, lineHeight: 1.15,
              marginBottom: 16, textWrap: "balance"
            }}>
              {pt.newsletter_inline_title}
            </div>
            <form onSubmit={(e) => {e.preventDefault();alert("Mock — prototype only");}} style={{
              display: "flex", gap: 8, flexWrap: "wrap"
            }}>
              <input type="email" required placeholder={t.newsletter.placeholder}
              style={{
                flex: 1, minWidth: 200,
                padding: "12px 14px", fontSize: 14,
                border: "1px solid #1A140C", background: "#FFFCEE",
                color: "#1A140C", fontFamily: '"Inter", sans-serif'
              }} />
              
              <button type="submit" style={{
                padding: "12px 20px", background: "#1A140C", color: marker,
                border: "none", fontFamily: '"JetBrains Mono", monospace',
                fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase",
                fontWeight: 600, cursor: "pointer"
              }}>
                {pt.newsletter_inline_cta}
              </button>
            </form>
            <div style={{ fontSize: 11, marginTop: 10, opacity: 0.65, fontFamily: '"JetBrains Mono", monospace' }}>
              {t.newsletter.footnote}
            </div>
            </div>
          }

          {/* Footnotes */}
          {footnotes.length > 0 &&
          <div style={{
            marginTop: 56, paddingTop: 28,
            borderTop: `1px solid ${line}`
          }}>
              <h3 style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 11, letterSpacing: "0.18em",
              textTransform: "uppercase", fontWeight: 600,
              color: muted, marginBottom: 18
            }}>
                {pt.footnotes_title}
              </h3>
              <ol style={{
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontSize: 15, lineHeight: 1.65,
              color: theme.ink, margin: 0, paddingLeft: 24,
              listStyle: "decimal"
            }}>
                {footnotes.map((fn, i) =>
              <li
                key={i}
                id={`fn-${i + 1}`}
                style={{
                  marginBottom: 14, paddingLeft: 4,
                  transition: "background 0.6s ease",
                  borderRadius: 3
                }}>
                
                    <span dangerouslySetInnerHTML={{ __html: fn }} />{" "}
                    <a
                  href={`#ref-${i + 1}`}
                  className="fn-back"
                  data-back={i + 1}
                  style={{
                    color: accent, textDecoration: "none",
                    fontSize: 13, marginLeft: 4
                  }}
                  aria-label="Back to reference">
                  
                      ↵
                    </a>
                  </li>
              )}
              </ol>
            </div>
          }

          {/* Colophon */}
          <div style={{
            marginTop: 56, padding: "22px 24px",
            borderTop: `1px dashed ${line}`, borderBottom: `1px dashed ${line}`,
            display: "flex", gap: 20, alignItems: "flex-start"
          }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10, letterSpacing: "0.14em",
              color: muted, textTransform: "uppercase", fontWeight: 600,
              minWidth: 80, paddingTop: 2
            }}>
              {pt.colophon_title}
            </div>
            <div
              style={{
                fontSize: 13, color: muted, lineHeight: 1.6,
                fontFamily: '"Source Serif 4", Georgia, serif', fontStyle: "italic"
              }}
              dangerouslySetInnerHTML={{ __html: pt.colophon_body }} />
            
          </div>

          {/* Coda ad — large house ad after article body */}
          {adCoda && <window.Coda ad={adCoda} L={L} theme={theme} />}

        </article>

        {/* Right: live panel — key points, pull-quote, highlights */}
        <aside style={{ position: "relative" }}>
          <div style={{ position: "sticky", top: 120, display: "flex", flexDirection: "column", gap: 28 }}>

            {/* Key points */}
            <div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: 10, letterSpacing: "0.16em",
                color: muted, textTransform: "uppercase", fontWeight: 600,
                marginBottom: 12
              }}>
                {pt.key_points_title}
              </div>
              <ol style={{
                margin: 0, padding: 0, listStyle: "none",
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontSize: 13, lineHeight: 1.5, color: ink
              }}>
                {pt.key_points.map((kp, i) =>
                <li key={i} style={{
                  display: "flex", gap: 10,
                  padding: "8px 0",
                  borderTop: i === 0 ? "none" : `1px dashed ${line}`
                }}>
                    <span style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 10, color: accent, fontWeight: 600,
                    minWidth: 14, paddingTop: 2,
                    letterSpacing: "0.04em"
                  }}>
                      0{i + 1}
                    </span>
                    <span style={{ textWrap: "pretty" }}>{kp}</span>
                  </li>
                )}
              </ol>
            </div>

            {/* Pull-quote annotation — handwritten */}
            <div style={{
              padding: "16px 14px",
              background: "transparent",
              borderLeft: `2px solid ${accent}`
            }}>
              <div style={{
                ...hand, fontSize: 22, color: accent, lineHeight: 1.25,
                marginBottom: 8,
                letterSpacing: "0.01em"
              }}>
                {pt.pullquote_text}
              </div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                letterSpacing: "0.12em", color: muted, textTransform: "uppercase"
              }}>
                — {pt.pullquote_attr}
              </div>
            </div>

            {/* Anchor ad — sticky right rail card */}
            {adAnchor && <window.Anchor ad={adAnchor} L={L} theme={theme} />}

            {/* User highlights panel */}
            <div>
              <div style={{
                display: "flex", alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 12, gap: 8
              }}>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 10, letterSpacing: "0.16em",
                  color: muted, textTransform: "uppercase", fontWeight: 600
                }}>
                  {pt.highlights_title}
                  {highlights.length > 0 &&
                  <span style={{
                    marginLeft: 6, color: accent, fontWeight: 700
                  }}>
                      {highlights.length}
                    </span>
                  }
                </div>
                {highlights.length > 0 &&
                <button
                  onClick={clearHighlights}
                  style={{
                    background: "transparent", border: "none",
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
                    color: muted, cursor: "pointer", padding: 0,
                    textDecoration: "underline", textUnderlineOffset: 3
                  }}>
                  
                    {pt.highlights_clear}
                  </button>
                }
              </div>
              {highlights.length === 0 ?
              <div style={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontStyle: "italic", fontSize: 12, color: muted,
                lineHeight: 1.45, textWrap: "pretty",
                padding: "10px 0"
              }}>
                  {pt.highlights_empty}
                </div> :

              <ul style={{
                margin: 0, padding: 0, listStyle: "none",
                display: "flex", flexDirection: "column", gap: 8,
                maxHeight: 260, overflowY: "auto", paddingRight: 4
              }}>
                  {highlights.map((h, i) =>
                <li key={h.at} style={{
                  position: "relative",
                  background: dark ? "rgba(255,214,102,0.1)" : "rgba(255,214,102,0.25)",
                  padding: "8px 24px 8px 10px",
                  borderLeft: "2px solid #FFD666",
                  fontFamily: '"Source Serif 4", Georgia, serif',
                  fontSize: 12.5, lineHeight: 1.45,
                  color: ink, textWrap: "pretty"
                }}>
                      {h.text.length > 140 ? h.text.slice(0, 140) + "…" : h.text}
                      <button
                    onClick={() => removeHighlight(h.at)}
                    aria-label="Remove highlight"
                    style={{
                      position: "absolute", top: 4, right: 4,
                      background: "transparent", border: "none",
                      color: muted, fontSize: 14, lineHeight: 1,
                      cursor: "pointer", padding: 2, opacity: 0.6
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = "0.6"}>
                    
                        ×
                      </button>
                    </li>
                )}
                </ul>
              }
            </div>
          </div>
        </aside>
      </div>

      {/* Related posts */}
      {related.length > 0 &&
      <section style={{
        maxWidth: 1280, margin: "0 auto", padding: "48px 28px 80px",
        borderTop: `1px dashed ${line}`
      }}>
          <div style={{ marginBottom: 40, display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{
              fontFamily: '"Fraunces", serif', fontSize: 34, fontWeight: 500,
              margin: "0 0 6px", color: ink, letterSpacing: "-0.015em"
            }}>
                {pt.related_title}
              </h2>
              <div style={{ fontSize: 13, color: muted, fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.04em" }}>
                {pt.related_sub} · <span style={{ color: cat.color, fontWeight: 600 }}>{cat[L]}</span>
              </div>
            </div>
            <a href={`blog.html?cat=${post.cat}`} style={{
            ...hand, fontSize: 20, color: accent, textDecoration: "none",
            transform: "rotate(-1deg)", display: "inline-block"
          }}>
              {t.category_view}
            </a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 40, rowGap: 48 }}>
            {related.map((p, i) =>
          <WritingCard key={p.slug} post={p} t={t} index={i} hrefBase="post.html?slug=" />
          )}
          </div>
        </section>
      }

      {/* Comments */}
      <section id="comments" style={{
        maxWidth: 920, margin: "0 auto", padding: "0 28px 80px"
      }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
          <h2 style={{
            fontFamily: '"Fraunces", serif', fontSize: 28, fontWeight: 500,
            margin: 0, color: ink
          }}>
            {pt.comments_title}
          </h2>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: muted, letterSpacing: "0.06em"
          }}>
            {C.commentsMock.length} {pt.comments_count}
          </span>
        </div>

        {/* Reply box */}
        <div style={{
          marginBottom: 36, padding: "18px 20px",
          border: `1px dashed ${line}`, background: dark ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.35)"
        }}>
          <textarea
            placeholder={pt.comment_placeholder}
            rows={3}
            style={{
              width: "100%", resize: "vertical",
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontSize: 15, lineHeight: 1.5, color: ink,
              background: "transparent", border: "none", outline: "none",
              padding: 0
            }} />
          
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginTop: 12, paddingTop: 12, borderTop: `1px solid ${line}`,
            flexWrap: "wrap", gap: 10
          }}>
            <div style={{ fontSize: 11, color: faint, fontFamily: '"JetBrains Mono", monospace' }}>
              {pt.comment_sign_in}
            </div>
            <button style={{
              padding: "8px 18px", background: accent, color: "#FFF", border: "none",
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
              letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
              cursor: "pointer"
            }}>
              {pt.comment_submit}
            </button>
          </div>
        </div>

        {/* Comment list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {C.commentsMock.map((c) =>
          <CommentThread key={c.id} comment={c} L={L} theme={theme} pt={pt} depth={0} />
          )}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: `1px dashed ${line}`, padding: "28px", textAlign: "center",
        color: faint, fontSize: 12,
        fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.08em"
      }}>
        <a href="Pinboard.html" style={{ color: accent, textDecoration: "none" }}>
          ← {L === "pt" ? "voltar pra home" : "back to home"}
        </a>
        <span style={{ margin: "0 16px", opacity: 0.5 }}>·</span>
        <a href="blog.html" style={{ color: muted, textDecoration: "none" }}>
          {L === "pt" ? "arquivo completo →" : "full archive →"}
        </a>
        <span style={{ margin: "0 16px", opacity: 0.5 }}>·</span>
        <a href="newsletters.html" style={{ color: muted, textDecoration: "none" }}>
          {L === "pt" ? "newsletters →" : "newsletters →"}
        </a>
      </footer>

      {/* Floating AI button */}
      <window.AIFloatingButton pt={pt} theme={theme} onClick={() => setAiOpen(true)} hidden={aiOpen} />

      {/* Footnote hover popover — shows footnote inline on hover */}
      {fnPopover &&
      <div
        onMouseEnter={() => {/* keep open */}}
        onMouseLeave={() => setFnPopover(null)}
        style={{
          position: "fixed",
          left: Math.max(16, Math.min(fnPopover.x - 180, window.innerWidth - 376)),
          top: fnPopover.y - 10,
          transform: "translateY(-100%)",
          width: 360,
          background: paper2,
          border: `1px solid ${line}`,
          borderLeft: `3px solid ${accent}`,
          padding: "14px 16px 13px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
          zIndex: 200,
          fontFamily: '"Source Serif 4", Georgia, serif',
          fontSize: 14, lineHeight: 1.55, color: ink,
          pointerEvents: "none"
        }}>
        
          <div style={{
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          letterSpacing: "0.12em", textTransform: "uppercase",
          color: accent, marginBottom: 6
        }}>
            {pt.footnote_label || "Nota"} {fnPopover.n}
          </div>
          <div dangerouslySetInnerHTML={{ __html: fnPopover.text }} />
        </div>
      }

      {/* Selection toolbar — appears when user highlights text */}
      {selTool &&
      <div
        data-sel-toolbar
        style={{
          position: "fixed",
          left: Math.max(80, Math.min(selTool.x, window.innerWidth - 80)),
          top: Math.max(60, selTool.y),
          transform: "translate(-50%, -100%)",
          zIndex: 120,
          background: dark ? "#1E1A14" : "#1A1410",
          color: "#F2EBDB",
          padding: "6px 4px 6px 10px",
          borderRadius: 8,
          fontFamily: '"Inter", sans-serif',
          fontSize: 12, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 6,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          animation: "btfFadeIn 0.15s ease"
        }}>
        
          <button
          onMouseDown={(e) => {
            e.preventDefault();
            addHighlight(selTool.text);
            window.getSelection()?.removeAllRanges();
            setSelTool(null);
          }}
          style={{
            background: "#FFD666", color: "#1A1410",
            border: "none", padding: "6px 12px",
            borderRadius: 5, fontFamily: "inherit",
            fontSize: 12, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 6
          }}>
          
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M16 3 L21 8 L8 21 L3 21 L3 16 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" fill="currentColor" fillOpacity="0.2" />
            </svg>
            {pt.highlights_hint}
          </button>
          <div style={{
          width: 1, height: 16, background: "rgba(255,255,255,0.15)"
        }} />
          <button
          onMouseDown={(e) => {
            e.preventDefault();
            navigator.clipboard?.writeText(selTool.text);
            setSelTool(null);
            window.getSelection()?.removeAllRanges();
          }}
          style={{
            background: "transparent", color: "#F2EBDB",
            border: "none", padding: "6px 10px",
            borderRadius: 5, fontFamily: "inherit",
            fontSize: 12, cursor: "pointer"
          }}
          title={L === "pt" ? "Copiar" : "Copy"}
          aria-label={L === "pt" ? "Copiar" : "Copy"}>
          
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M6 14 L5 14 A1 1 0 0 1 4 13 L4 5 A1 1 0 0 1 5 4 L13 4 A1 1 0 0 1 14 5 L14 6" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
          {/* downward arrow */}
          <div style={{
          position: "absolute", bottom: -5, left: "50%",
          transform: "translateX(-50%) rotate(45deg)",
          width: 10, height: 10,
          background: dark ? "#1E1A14" : "#1A1410"
        }} />
        </div>
      }

      {/* AI drawer */}
      {aiOpen &&
      <window.AIDrawer
        pt={pt}
        theme={theme}
        post={post}
        L={L}
        plainText={plainText}
        onClose={() => setAiOpen(false)} />

      }
    </div>);

};

// ---------- Helper components ----------

const CodeBlock = ({ block, theme }) => {
  const [copied, setCopied] = React.useState(false);
  const onCopy = () => {
    navigator.clipboard?.writeText(block.text || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <pre style={{
      position: "relative",
      margin: "1.6em 0",
      padding: "18px 22px",
      background: theme.dark ? "#1A1410" : "#1A140C",
      color: "#F2EBDB",
      overflowX: "auto",
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: 13, lineHeight: 1.6,
      border: `1px solid ${theme.dark ? "#2A241A" : "#1A140C"}`
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 10
      }}>
        <div style={{
          fontSize: 10, letterSpacing: "0.14em", color: "#9A8F7C",
          textTransform: "uppercase", fontWeight: 600
        }}>
          {block.lang || "code"}
        </div>
        <button
          onClick={onCopy}
          style={{
            background: "transparent",
            border: "1px solid rgba(242,235,219,0.15)",
            color: copied ? "#FFD666" : "#9A8F7C",
            fontFamily: '"JetBrains Mono", ui-monospace, monospace',
            fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
            fontWeight: 600,
            padding: "4px 8px", borderRadius: 3,
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5,
            transition: "color 0.15s, border-color 0.15s"
          }}
          title={copied ? "copiado" : "copiar"}>
          
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            {copied ?
            <path d="M5 12 L10 17 L19 7" strokeLinecap="round" strokeLinejoin="round" /> :

            <>
                <rect x="8" y="8" width="12" height="12" rx="2" />
                <path d="M6 14 L5 14 A1 1 0 0 1 4 13 L4 5 A1 1 0 0 1 5 4 L13 4 A1 1 0 0 1 14 5 L14 6" />
              </>
            }
          </svg>
          {copied ? "copiado" : "copiar"}
        </button>
      </div>
      <code style={{ whiteSpace: "pre", color: "#F2EBDB" }}>{block.text}</code>
    </pre>);

};

const CommentThread = ({ comment, L, theme, pt, depth }) => {
  const { ink, muted, faint, accent, line, paper2 } = theme;
  const [liked, setLiked] = React.useState(false);
  const [replyOpen, setReplyOpen] = React.useState(false);

  const likes = comment.likes + (liked ? 1 : 0);
  const replies = comment.replies || [];

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <Avatar initials={comment.avatar_initials} size={depth === 0 ? 40 : 32} theme={theme} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: depth === 0 ? 14 : 13, fontWeight: 600, color: ink, whiteSpace: "nowrap" }}>
            {comment.author}
          </span>
          {comment.isAuthor &&
          <span style={{
            fontSize: 9, fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
            padding: "2px 6px",
            background: accent, color: "#FFF",
            borderRadius: 3
          }}>
              {pt.engagement.author_reply}
            </span>
          }
          <span style={{
            fontSize: 11, color: faint,
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: "0.04em", whiteSpace: "nowrap"
          }}>
            {comment["date_" + L]}
          </span>
        </div>
        <div style={{
          fontSize: depth === 0 ? 15 : 14, color: ink, lineHeight: 1.55,
          fontFamily: '"Source Serif 4", Georgia, serif', marginBottom: 10,
          textWrap: "pretty"
        }}>
          {comment["text_" + L]}
        </div>
        <div style={{
          display: "flex", gap: 18, alignItems: "center",
          fontSize: 12, color: muted,
          fontFamily: '"JetBrains Mono", monospace',
          letterSpacing: "0.04em"
        }}>
          <button
            onClick={() => setLiked(!liked)}
            style={{
              ...linkBtn(liked ? accent : muted),
              display: "flex", alignItems: "center", gap: 5,
              transition: "color 0.15s"
            }}>
            
            <svg width="13" height="13" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {likes}
          </button>
          <button
            onClick={() => setReplyOpen(!replyOpen)}
            style={linkBtn(replyOpen ? accent : muted)}>
            
            ↩ {pt.comment_reply}
          </button>
        </div>

        {replyOpen &&
        <div style={{
          marginTop: 14, padding: "12px 14px",
          background: paper2, border: `1px solid ${line}`,
          borderRadius: 6, display: "flex", gap: 10, alignItems: "flex-start"
        }}>
            <textarea
            placeholder={pt.comment_placeholder}
            rows={2}
            style={{
              flex: 1, resize: "vertical", minHeight: 44,
              padding: 8, background: "transparent",
              border: "none", outline: "none",
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontSize: 14, color: ink
            }} />
          
            <button
            onClick={() => setReplyOpen(false)}
            style={{
              padding: "6px 12px", background: accent, color: "#FFF",
              border: "none", borderRadius: 4,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
              letterSpacing: "0.12em", textTransform: "uppercase",
              cursor: "pointer", alignSelf: "flex-start"
            }}>
            
              {pt.comment_submit}
            </button>
          </div>
        }

        {/* Replies (one level deep) */}
        {replies.length > 0 &&
        <div style={{
          marginTop: 20,
          paddingLeft: 16,
          borderLeft: `1px dashed ${line}`,
          display: "flex", flexDirection: "column", gap: 22
        }}>
            {replies.map((r) =>
          <CommentThread key={r.id} comment={r} L={L} theme={theme} pt={pt} depth={depth + 1} />
          )}
          </div>
        }
      </div>
    </div>);

};

const Avatar = ({ initials, size, theme }) =>
<div style={{
  width: size, height: size, borderRadius: "50%",
  background: `linear-gradient(135deg, ${theme.accent}, ${theme.marker})`,
  color: "#1A140C", display: "flex", alignItems: "center", justifyContent: "center",
  fontFamily: '"Fraunces", serif', fontSize: size * 0.4, fontWeight: 600,
  border: `2px solid ${theme.paper}`,
  boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
  flexShrink: 0
}}>
    {initials}
  </div>;


const ShareRow = ({ post, pt, theme, copied, onCopy, vertical }) => {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const title = post["title_" + window._lang];
  const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
  const lnUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  const btnStyle = {
    width: 34, height: 34,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    border: `1px solid ${theme.line}`,
    background: "transparent", color: theme.muted,
    fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
    textDecoration: "none", cursor: "pointer",
    transition: "all 0.15s"
  };
  return (
    <div style={{
      display: "flex", gap: 6,
      flexDirection: vertical ? "column" : "row",
      alignItems: vertical ? "flex-start" : "center"
    }}>
      <a href={xUrl} target="_blank" rel="noopener" title={pt.share_x} aria-label={pt.share_x} style={btnStyle}>
        𝕏
      </a>
      <a href={lnUrl} target="_blank" rel="noopener" title={pt.share_ln} aria-label={pt.share_ln} style={btnStyle}>
        in
      </a>
      <button onClick={onCopy} title={pt.share_copy} aria-label={pt.share_copy} style={{
        ...btnStyle,
        width: copied ? "auto" : 34,
        padding: copied ? "0 10px" : 0,
        color: copied ? theme.accent : theme.muted,
        borderColor: copied ? theme.accent : theme.line,
        whiteSpace: "nowrap"
      }}>
        {copied ? pt.share_copied :
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M9 12a3 3 0 0 0 0 4.243l1.414 1.414a3 3 0 0 0 4.243 0l2.828-2.828a3 3 0 0 0 0-4.243l-1.414-1.414" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M15 12a3 3 0 0 0 0-4.243l-1.414-1.414a3 3 0 0 0-4.243 0l-2.828 2.828a3 3 0 0 0 0 4.243l1.414 1.414" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        }
      </button>
    </div>);

};

// ---------- Block renderer ----------

const Block = ({ block, L, theme }) => {
  const { ink, muted, accent, paper, paper2, line } = theme;

  if (block.type === "p") {
    return (
      <p
        style={{ margin: "0 0 1.2em", color: ink, textWrap: "pretty" }}
        dangerouslySetInnerHTML={{ __html: block.text }} />);


  }

  if (block.type === "h2") {
    return (
      <h2 id={block.id} style={{
        fontFamily: '"Fraunces", serif',
        fontSize: 32, fontWeight: 500, lineHeight: 1.15,
        color: ink, margin: "2.2em 0 0.6em",
        letterSpacing: "-0.015em", scrollMarginTop: 100
      }}>
        {block["text_" + L] || block.text}
      </h2>);

  }

  if (block.type === "h3") {
    return (
      <h3 id={block.id} style={{
        fontFamily: '"Fraunces", serif',
        fontSize: 22, fontWeight: 500, lineHeight: 1.2,
        color: ink, margin: "1.8em 0 0.4em",
        letterSpacing: "-0.01em", scrollMarginTop: 100
      }}>
        {block["text_" + L] || block.text}
      </h3>);

  }

  if (block.type === "quote") {
    return (
      <blockquote style={{
        margin: "1.6em 0",
        padding: "20px 28px",
        borderLeft: `3px solid ${accent}`,
        background: paper,
        fontFamily: '"Fraunces", serif',
        fontSize: 22, lineHeight: 1.4,
        color: ink, fontStyle: "italic",
        fontWeight: 400
      }}>
        "{block.text}"
      </blockquote>);

  }

  if (block.type === "list") {
    return (
      <ul style={{
        margin: "0 0 1.4em", paddingLeft: 22, color: ink,
        listStyle: "none"
      }}>
        {block.items.map((it, i) =>
        <li key={i} style={{
          position: "relative", marginBottom: "0.7em",
          paddingLeft: 6, lineHeight: 1.65
        }}
        dangerouslySetInnerHTML={{
          __html:
          `<span style="position:absolute;left:-18px;top:2px;color:${accent};font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:600">→</span>` +
          it
        }} />

        )}
      </ul>);

  }

  if (block.type === "code") {
    return <CodeBlock block={block} theme={theme} />;
  }

  if (block.type === "callout") {
    return (
      <div style={{
        margin: "1.8em 0",

        background: paper2,
        borderTop: `2px solid ${accent}`,
        borderBottom: `2px solid ${accent}`,
        fontFamily: '"Source Serif 4", serif',
        fontSize: 17, color: ink, lineHeight: 1.55,
        fontStyle: "italic", padding: "0px 22px 18px"
      }}>
        ⚡ {block.text}
      </div>);

  }

  if (block.type === "figure") {
    return (
      <figure style={{ margin: "1.8em 0" }}>
        <div style={{
          aspectRatio: "16/9",
          ...window.postImg(block.img || { h: 30, h2: 80, pattern: "grid" }, { dark: theme.dark }),
          border: `1px solid ${line}`
        }} />
        {block.caption &&
        <figcaption style={{
          fontFamily: '"Source Serif 4", serif',
          fontSize: 13, color: muted, fontStyle: "italic",
          textAlign: "center", marginTop: 10
        }}>
            {block.caption}
          </figcaption>
        }
      </figure>);

  }

  return null;
};

// ---------- Styles ----------

const linkBtn = (color) => ({
  background: "transparent", border: "none", color,
  fontFamily: '"JetBrains Mono", monospace', fontSize: 12,
  letterSpacing: "0.04em", cursor: "pointer", padding: 0
});

window.PostPage = PostPage;