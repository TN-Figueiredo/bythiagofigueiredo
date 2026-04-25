/*
 * Videos archive page — filters by series + tag, search, sort, URL-param state.
 */

const VideosArchive = ({ t, dark, content }) => {
  const C = content;
  const vids = C.videos;
  const channels = C.channels;
  const sites = C.sites;
  const L = window._lang;

  const theme = window.makePinboardTheme(dark);
  const kit = window.makePinboardKit(theme);
  const { PageHeader, VideoCard } = kit;
  const { bg, ink, muted, faint, line, accent, marker, hand, yt } = theme;

  const primaryCh = channels.find(c => c.locale === L) || channels[0];

  // ---------- URL-param–synced state ----------
  const readParams = () => {
    const p = new URLSearchParams(window.location.search);
    return {
      series: p.get("series") || "all",
      tag: p.get("tag") || "",
      q: p.get("q") || "",
      sort: p.get("sort") || "recent", // recent | longest | shortest
    };
  };
  const [filters, setFilters] = React.useState(readParams);

  React.useEffect(() => {
    const p = new URLSearchParams();
    if (filters.series !== "all") p.set("series", filters.series);
    if (filters.tag) p.set("tag", filters.tag);
    if (filters.q) p.set("q", filters.q);
    if (filters.sort !== "recent") p.set("sort", filters.sort);
    const qs = p.toString();
    const url = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  }, [filters]);

  const update = (patch) => setFilters(f => ({ ...f, ...patch }));
  const reset = () => setFilters({ series: "all", tag: "", q: "", sort: "recent" });

  // ---------- Derived ----------
  // Series keyed by PT label (stable) but displayed with locale label
  const seriesList = React.useMemo(() => {
    const seen = new Map();
    vids.forEach(v => {
      const key = v.series_pt;
      if (!seen.has(key)) {
        seen.set(key, { key, label: v["series_" + L], count: 1 });
      } else {
        seen.get(key).count++;
      }
    });
    return Array.from(seen.values());
  }, [vids, L]);

  const allTags = React.useMemo(() => {
    const counts = {};
    vids.forEach(v => (v.tags || []).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([tag, n]) => ({ tag, n }));
  }, [vids]);

  // Parse duration "MM:SS" or "HH:MM:SS" -> seconds
  const durSecs = (d) => {
    const parts = String(d || "0:00").split(":").map(n => parseInt(n, 10) || 0);
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  };

  const filtered = React.useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    let arr = vids.filter(v => {
      if (filters.series !== "all" && v.series_pt !== filters.series) return false;
      if (filters.tag && !(v.tags || []).includes(filters.tag)) return false;
      if (q) {
        const hay = [
          v["title_" + L],
          v["desc_" + L],
          v["series_" + L],
          v.id,
          ...(v.tags || []),
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    if (filters.sort === "recent") arr = arr.slice().sort((a, b) => (b.iso > a.iso ? 1 : -1));
    if (filters.sort === "longest") arr = arr.slice().sort((a, b) => durSecs(b.duration) - durSecs(a.duration));
    if (filters.sort === "shortest") arr = arr.slice().sort((a, b) => durSecs(a.duration) - durSecs(b.duration));
    return arr;
  }, [vids, filters, L]);

  const hasFilters = filters.series !== "all" || filters.tag || filters.q || filters.sort !== "recent";

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

  const headerCTAs = (
    <>
      <a href={primaryCh.url} target="_blank" rel="noopener" style={{
        padding: "7px 13px",
        background: "transparent", color: yt,
        border: `1.5px solid ${yt}`,
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
        letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700,
        textDecoration: "none",
        display: "inline-flex", alignItems: "center", gap: 5,
      }}>▶ YouTube</a>
      <a href="newsletters.html" style={{
        padding: "7px 13px",
        background: accent, color: "#FFF",
        border: `1.5px solid ${accent}`,
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
        letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700,
        textDecoration: "none",
        display: "inline-flex", alignItems: "center", gap: 5,
      }}>✉ Newsletter</a>
    </>
  );

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

      <PageHeader nav={nav} current="videos" ctas={headerCTAs}/>

      {/* Page title */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 28px 24px" }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: yt, marginBottom: 10 }}>
          / {L === "pt" ? "canal" : "channel"} · {vids.length} {L === "pt" ? "vídeos" : "videos"}
        </div>
        <h1 style={{
          fontFamily: '"Fraunces", serif', fontSize: 64, margin: 0, fontWeight: 500,
          letterSpacing: "-0.03em", lineHeight: 1.0, position: "relative", display: "inline-block",
        }}>
          {L === "pt" ? "Todos os vídeos" : "Every video"}
          <span style={{
            position: "absolute", bottom: 4, left: -6, right: -6, height: 18,
            background: marker, zIndex: -1, opacity: 0.7, transform: "skew(-2deg)",
          }}/>
        </h1>
        <p style={{ fontSize: 16, color: muted, marginTop: 18, maxWidth: 680, lineHeight: 1.6 }}>
          {L === "pt"
            ? "Live-coding, tours de setup, diário de bugs. Tudo que foi ao canal, filtrável por série."
            : "Live-coding, setup tours, bug diary. Everything from the channel, filterable by series."}
        </p>

        {/* Channel links */}
        <div style={{ display: "flex", gap: 14, marginTop: 22, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: faint }}>
            {L === "pt" ? "canais:" : "channels:"}
          </span>
          {channels.map(c => (
            <a key={c.url} href={c.url} target="_blank" rel="noopener" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "6px 12px",
              border: `1px solid ${line}`,
              color: ink, textDecoration: "none",
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
            }}>
              <span style={{ color: yt }}>▶</span>
              {c.name}
              <span style={{ color: faint, fontSize: 10 }}>· {c.locale.toUpperCase()}</span>
            </a>
          ))}
        </div>
      </section>

      {/* Filter bar */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 28px 0" }}>

        {/* Row: search + sort */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 440 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: faint, pointerEvents: "none" }}>⌕</span>
            <input
              type="text"
              value={filters.q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder={L === "pt" ? "buscar por título, tag, série…" : "search title, tag, series…"}
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
              background: "transparent", color: yt,
              border: `1px dashed ${yt}`,
              marginLeft: "auto",
            }}>
              ✕ {L === "pt" ? "limpar tudo" : "clear all"}
            </button>
          )}
        </div>

        {/* Row: series */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: faint, marginRight: 4 }}>
            {L === "pt" ? "série:" : "series:"}
          </span>
          {[{ key: "all", label: L === "pt" ? "Tudo" : "All", count: vids.length }, ...seriesList].map(({ key, label, count }) => {
            const active = filters.series === key;
            return (
              <button key={key} onClick={() => update({ series: key })} style={{
                ...chipBase,
                background: active ? yt : "transparent",
                color: active ? "#FFF" : ink,
                border: `1.5px solid ${active ? yt : line}`,
                transform: active ? `rotate(${((String(key).charCodeAt(0) || 0) % 3 - 1) * 0.6}deg)` : "none",
              }}>
                {key === "all" ? "" : "▶"} {label}
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

      {/* Results */}
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px 96px" }}>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: muted, letterSpacing: "0.06em" }}>
            <span style={{ color: ink, fontWeight: 600 }}>{filtered.length}</span>
            {" "}
            {filtered.length === 1 ? (L === "pt" ? "vídeo" : "video") : (L === "pt" ? "vídeos" : "videos")}
            {hasFilters && (
              <span style={{ color: faint, marginLeft: 8 }}>
                · {L === "pt" ? "filtrando" : "filtered"}
                {filters.series !== "all" && (() => {
                  const match = seriesList.find(s => s.key === filters.series);
                  return <> · {match ? match.label : filters.series}</>;
                })()}
                {filters.tag && <> · #{filters.tag}</>}
                {filters.q && <> · "{filters.q}"</>}
              </span>
            )}
          </div>
          {!hasFilters && (
            <div style={{ ...hand, fontSize: 17, color: yt, transform: "rotate(-1deg)" }}>
              ↓ {L === "pt" ? "os mais recentes" : "newest first"}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: "80px 0", textAlign: "center" }}>
            <div style={{ ...hand, fontSize: 32, color: muted, marginBottom: 12 }}>
              {L === "pt" ? "nenhum vídeo." : "no videos."}
            </div>
            <div style={{ fontSize: 14, color: faint, marginBottom: 24 }}>
              {L === "pt" ? "tenta limpar os filtros ou outra série." : "try clearing filters or another series."}
            </div>
            <button onClick={reset} style={{
              padding: "10px 22px",
              background: yt, color: "#FFF", border: "none",
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
              letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600,
              cursor: "pointer",
            }}>
              {L === "pt" ? "limpar filtros" : "clear filters"}
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, rowGap: 48, paddingTop: 12 }}>
            {filtered.map((v, i) => (
              <VideoCard key={v.id} v={v} index={i} aspect="16/9" hrefBase="#"/>
            ))}
          </div>
        )}
      </section>

      {/* Footer strip */}
      <footer style={{ borderTop: `1px dashed ${line}`, padding: "28px", textAlign: "center", color: faint, fontSize: 12, fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.08em" }}>
        <a href="Pinboard.html" style={{ color: accent, textDecoration: "none" }}>← {L === "pt" ? "voltar pra home" : "back to home"}</a>
        <span style={{ margin: "0 16px", opacity: 0.5 }}>·</span>
        <a href="blog.html" style={{ color: muted, textDecoration: "none" }}>{L === "pt" ? "blog →" : "blog →"}</a>
      </footer>
    </div>
  );
};

window.VideosArchive = VideosArchive;
