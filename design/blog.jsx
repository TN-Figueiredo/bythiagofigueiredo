/*
 * Blog archive page — filters by category + tag, search, sort, URL-param state.
 * Pattern mirrors pinboard: makePinboardTheme(dark) + makePinboardKit(theme).
 */

const BlogArchive = ({ t, dark, content, adsConfig }) => {
  const C = content;
  const posts = C.posts;
  const cats = C.categories;
  const sites = C.sites;
  const L = window._lang;

  const theme = window.makePinboardTheme(dark);
  const kit = window.makePinboardKit(theme);
  const { PageHeader, WritingCard } = kit;
  const { bg, ink, muted, faint, line, accent, marker, hand, paper } = theme;

  // ---- Ad selection (mirrors pinboard.jsx) ----
  const adsCfg = adsConfig || { enabled: true, slots: { marginalia: true, anchor: true, bookmark: true, bowtie: true, doorman: false } };
  const adsEnabled = adsCfg.enabled && window.AdsContent;
  const adSlot = adsCfg.slots || {};
  const sponsorList = adsEnabled ? Object.values(window.AdsContent.sponsors) : [];
  const houseList = adsEnabled ? Object.values(window.AdsContent.houseAds) : [];
  // Rotate daily so archive feels fresh on revisits — offset +2 so we don't show the
  // exact same picks as the home page on the same day.
  const adH = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) + 2;
  const pickSponsor = (i = 0) => sponsorList.length ? sponsorList[Math.abs(adH + i) % sponsorList.length] : null;
  const pickHouse = (i = 0) => houseList.length ? houseList[Math.abs(adH + i) % houseList.length] : null;
  const adDoorman    = adsEnabled && adSlot.doorman    ? pickHouse(0)   : null;
  const adAnchor     = adsEnabled && adSlot.anchor     ? pickSponsor(0) : null;
  const adBookmark   = adsEnabled && adSlot.bookmark   ? pickSponsor(1) : null;
  const adMarginalia = adsEnabled && adSlot.marginalia ? pickHouse(1)   : null;
  const adBowtie     = adsEnabled && adSlot.bowtie     ? (window.AdsContent && window.AdsContent.houseAds.newsletter) || pickHouse(2) : null;

  // ---------- URL-param–synced state ----------
  const readParams = () => {
    const p = new URLSearchParams(window.location.search);
    return {
      cat: p.get("cat") || "all",
      tag: p.get("tag") || "",
      q: p.get("q") || "",
      sort: p.get("sort") || "recent", // recent | popular (read-time desc)
    };
  };
  const [filters, setFilters] = React.useState(readParams);

  // Push state to URL (shallow)
  React.useEffect(() => {
    const p = new URLSearchParams();
    if (filters.cat !== "all") p.set("cat", filters.cat);
    if (filters.tag) p.set("tag", filters.tag);
    if (filters.q) p.set("q", filters.q);
    if (filters.sort !== "recent") p.set("sort", filters.sort);
    const qs = p.toString();
    const url = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  }, [filters]);

  const update = (patch) => setFilters(f => ({ ...f, ...patch }));
  const reset = () => setFilters({ cat: "all", tag: "", q: "", sort: "recent" });

  // ---------- Derived data ----------
  // Union of all tags (sorted by usage count, cap at 20 chips)
  const allTags = React.useMemo(() => {
    const counts = {};
    posts.forEach(p => (p.tags || []).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag, n]) => ({ tag, n }));
  }, [posts]);

  const filtered = React.useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    let arr = posts.filter(p => {
      if (filters.cat !== "all" && p.cat !== filters.cat) return false;
      if (filters.tag && !(p.tags || []).includes(filters.tag)) return false;
      if (q) {
        const hay = [
          p["title_" + L],
          p["excerpt_" + L],
          p.slug,
          ...(p.tags || []),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (filters.sort === "recent") arr = arr.slice().sort((a, b) => (b.iso > a.iso ? 1 : -1));
    if (filters.sort === "longest") arr = arr.slice().sort((a, b) => Number(b.read) - Number(a.read));
    if (filters.sort === "shortest") arr = arr.slice().sort((a, b) => Number(a.read) - Number(b.read));
    return arr;
  }, [posts, filters, L]);

  const hasFilters = filters.cat !== "all" || filters.tag || filters.q || filters.sort !== "recent";

  // ---------- UI ----------
  const nav = [
    { key: "home", href: "Pinboard.html", label: t.nav.home },
    { key: "writing", href: "blog.html", label: t.nav.writing },
    { key: "videos", href: "videos.html", label: t.nav.videos },
    { key: "newsletters", href: "newsletters.html", label: t.nav.newsletter },
    { key: "about", href: "#", label: t.nav.about },
    { key: "contact", href: sites.contact.url, label: sites.contact["label_" + L] },
    { key: "dev", href: sites.dev.url, label: sites.dev["label_" + L], external: true },
  ];

  const chipBase = {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "7px 13px",
    fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
    letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
    cursor: "pointer", transition: "all 0.15s",
  };

  const sortLabels = L === "pt"
    ? { recent: "Mais recentes", longest: "Mais longos", shortest: "Mais curtos" }
    : { recent: "Newest", longest: "Longest", shortest: "Shortest" };

  return (
    <div id="top" style={{ background: bg, color: ink, minHeight: "100vh", fontFamily: '"Inter", sans-serif' }}>

      {/* Doorman ad — dismissable banner above the header (off by default) */}
      {adDoorman && <window.Doorman ad={adDoorman} L={L} theme={theme}/>}

      <PageHeader nav={nav} current="writing" ctas={
        <a href="newsletters.html" style={{
          padding: "7px 13px",
          background: accent, color: "#FFF",
          border: `1.5px solid ${accent}`,
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700,
          textDecoration: "none",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>✉ Newsletter</a>
      }/>

      {/* Page title */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 28px 24px" }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: accent, marginBottom: 10 }}>
          / {L === "pt" ? "arquivo" : "archive"} · {posts.length} {L === "pt" ? "posts" : "posts"}
        </div>
        <h1 style={{
          fontFamily: '"Fraunces", serif', fontSize: 64, margin: 0, fontWeight: 500,
          letterSpacing: "-0.03em", lineHeight: 1.0, position: "relative", display: "inline-block",
        }}>
          {L === "pt" ? "Tudo que eu escrevi" : "Everything I've written"}
          <span style={{
            position: "absolute", bottom: 4, left: -6, right: -6, height: 18,
            background: marker, zIndex: -1, opacity: 0.7, transform: "skew(-2deg)",
          }}/>
        </h1>
        <p style={{ fontSize: 16, color: muted, marginTop: 18, maxWidth: 680, lineHeight: 1.6 }}>
          {L === "pt"
            ? "Ensaios, código, diário, carreira. Tudo em um só lugar — filtra, busca, ou só rola e lê o que chamar atenção."
            : "Essays, code, diary, career. All in one place — filter, search, or just scroll and read what catches your eye."}
        </p>
      </section>

      {/* Filter bar */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "8px 28px 0" }}>

        {/* Row: search + sort */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 440 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: faint, pointerEvents: "none" }}>⌕</span>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder={L === "pt" ? "buscar por título, tag, slug…" : "search title, tag, slug…"}
              style={{
                width: "100%", padding: "12px 14px 12px 36px",
                border: `1.5px solid ${line}`, background: "transparent", color: ink,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 13,
                outline: "none",
              }}
            />
            {filters.q && (
              <button onClick={() => update({ q: "" })} style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "transparent", border: "none", color: faint, fontSize: 16, cursor: "pointer", padding: 4,
              }}>×</button>
            )}
          </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: faint, marginRight: 4 }}>
              {L === "pt" ? "ordenar:" : "sort:"}
            </span>
            {Object.entries(sortLabels).map(([key, label]) => {
              const active = filters.sort === key;
              return (
                <button key={key} onClick={() => update({ sort: key })} style={{
                  ...chipBase,
                  padding: "5px 10px", fontSize: 10,
                  background: active ? ink : "transparent",
                  color: active ? (dark ? "#141210" : "#FBF6E8") : muted,
                  border: `1px solid ${active ? ink : line}`,
                }}>
                  {label}
                </button>
              );
            })}
          </div>

          {hasFilters && (
            <button onClick={reset} style={{
              ...chipBase,
              padding: "5px 10px", fontSize: 10,
              background: "transparent", color: accent,
              border: `1px dashed ${accent}`,
              marginLeft: "auto",
            }}>
              ✕ {L === "pt" ? "limpar tudo" : "clear all"}
            </button>
          )}
        </div>

        {/* Row: categories */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: faint, marginRight: 4 }}>
            {L === "pt" ? "categoria:" : "category:"}
          </span>
          {[["all", L === "pt" ? "Tudo" : "All"], ...Object.entries(cats).map(([k, c]) => [k, c[L]])].map(([key, label]) => {
            const active = filters.cat === key;
            const color = key === "all" ? ink : cats[key].color;
            const count = key === "all" ? posts.length : posts.filter(p => p.cat === key).length;
            return (
              <button key={key} onClick={() => update({ cat: key })} style={{
                ...chipBase,
                background: active ? color : "transparent",
                color: active ? "#FFF" : ink,
                border: `1.5px solid ${active ? color : line}`,
                transform: active ? `rotate(${((String(key).charCodeAt(0) || 0) % 3 - 1) * 0.6}deg)` : "none",
              }}>
                {label}
                <span style={{
                  fontSize: 10, opacity: active ? 0.85 : 0.55,
                  padding: "1px 5px",
                  background: active ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.06)",
                  borderRadius: 3, fontWeight: 500,
                }}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row: tags */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 28, paddingBottom: 24, borderBottom: `1px dashed ${line}`, alignItems: "center" }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: faint, marginRight: 4 }}>
            {L === "pt" ? "tags:" : "tags:"}
          </span>
          {allTags.map(({ tag, n }) => {
            const active = filters.tag === tag;
            return (
              <button key={tag} onClick={() => update({ tag: active ? "" : tag })} style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "4px 9px",
                background: active ? accent : "transparent",
                color: active ? "#FFF" : muted,
                border: `1px solid ${active ? accent : line}`,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5,
                letterSpacing: "0.04em", cursor: "pointer",
                transition: "all 0.15s",
              }}>
                #{tag}
                <span style={{ fontSize: 9, opacity: active ? 0.8 : 0.5 }}>{n}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* HorizontalAnchor sponsor — full-width row between filters and results.
          Acts as a quiet section break — it separates "what you searched"
          from "what we found" without competing with the cards. */}
      {adAnchor && (
        <section style={{ maxWidth: 1280, margin: "0 auto 28px", padding: "0 28px" }}>
          <window.HorizontalAnchor ad={adAnchor} L={L} theme={theme}/>
        </section>
      )}

      {/* Results */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px 96px" }}>

        {/* Result count + active filter summary */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: muted, letterSpacing: "0.06em" }}>
            <span style={{ color: ink, fontWeight: 600 }}>{filtered.length}</span>
            {" "}
            {filtered.length === 1 ? (L === "pt" ? "resultado" : "result") : (L === "pt" ? "resultados" : "results")}
            {hasFilters && (
              <span style={{ color: faint, marginLeft: 8 }}>
                · {L === "pt" ? "filtrando" : "filtered"}
                {filters.cat !== "all" && <> · {cats[filters.cat][L]}</>}
                {filters.tag && <> · #{filters.tag}</>}
                {filters.q && <> · "{filters.q}"</>}
              </span>
            )}
          </div>
          {!hasFilters && (
            <div style={{ ...hand, fontSize: 17, color: accent, transform: "rotate(-1deg)" }}>
              ↓ {L === "pt" ? "começa por aqui" : "start here"}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: "80px 0", textAlign: "center" }}>
            <div style={{ ...hand, fontSize: 32, color: muted, marginBottom: 12 }}>
              {L === "pt" ? "nada por aqui." : "nothing here."}
            </div>
            <div style={{ fontSize: 14, color: faint, marginBottom: 24 }}>
              {L === "pt" ? "tenta limpar os filtros ou buscar outra palavra." : "try clearing the filters or searching for another word."}
            </div>
            <button onClick={reset} style={{
              padding: "10px 22px",
              background: accent, color: "#FFF", border: "none",
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
              letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600,
              cursor: "pointer",
            }}>
              {L === "pt" ? "limpar filtros" : "clear filters"}
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 40, rowGap: 56 }}>
            {filtered.map((p, i) => {
              // Inject the Bookmark sponsor scrap inline at position 6 (start of row 3)
              // so it occupies one card cell. Falls back to end of grid for short lists.
              const bookmarkAt = filtered.length >= 7 ? 6 : Math.max(0, filtered.length - 1);
              const showBookmarkBefore = adBookmark && i === bookmarkAt;
              return (
                <React.Fragment key={p.slug}>
                  {showBookmarkBefore && (
                    <div style={{
                      gridColumn: "span 1",
                      display: "flex", alignItems: "stretch",
                    }}>
                      <window.Bookmark ad={adBookmark} L={L} theme={theme}/>
                    </div>
                  )}
                  <WritingCard post={p} t={t} index={i} hrefBase="post.html?slug="/>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </section>

      {/* Marginalia (house, paper variant) — quiet note above the bowtie/footer.
          Sits at the same width as the page chrome so it reads as marginalia
          to the whole archive, not to a single result. */}
      {adMarginalia && (
        <section style={{ maxWidth: 720, margin: "0 auto", padding: "8px 28px 0" }}>
          <window.Marginalia ad={adMarginalia} L={L} theme={theme} variant="paper"/>
        </section>
      )}

      {/* Bowtie — house newsletter card before the footer */}
      {adBowtie && (
        <section style={{ maxWidth: 920, margin: "0 auto", padding: "40px 28px 0" }}>
          <window.Bowtie ad={adBowtie} L={L} theme={theme}/>
        </section>
      )}

      {/* Footer strip */}
      <footer style={{ borderTop: `1px dashed ${line}`, padding: "28px", textAlign: "center", color: faint, fontSize: 12, fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.08em" }}>
        <a href="Pinboard.html" style={{ color: accent, textDecoration: "none" }}>← {L === "pt" ? "voltar pra home" : "back to home"}</a>
        <span style={{ margin: "0 16px", opacity: 0.5 }}>·</span>
        <a href="videos.html" style={{ color: muted, textDecoration: "none" }}>{L === "pt" ? "vídeos →" : "videos →"}</a>
      </footer>
    </div>
  );
};

window.BlogArchive = BlogArchive;
