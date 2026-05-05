/*
 * youtube.jsx — bythiagofigueiredo's YouTube page (replaces videos.jsx)
 * Editorial pinboard treatment for the channel.
 *
 * Spine (v2 — refined):
 *   - Hero (locale-adaptive, balanced text+thumb composition)
 *   - Channel duplex strip (both channels, side by side)
 *   - "Esta semana" — single editorial pick + 3 mini cards
 *   - Comments wall (curated, taped scraps)
 *   - Archive (filter bar + paged grid, with channel/flag chips on every card)
 *   - Subscribe duplex
 */

const YouTubePage = ({ t, dark, content, adsConfig }) => {
  const C = content;
  const vids = C.videos;
  const channels = C.channels;
  const sites = C.sites;
  const allComments = C.videoComments || [];
  const L = window._lang;

  const theme = window.makePinboardTheme(dark);
  const kit = window.makePinboardKit(theme);
  const { PageHeader, VideoCard, Paper, Tape, VideoThumb } = kit;
  const { bg, ink, muted, faint, line, accent, marker, hand, yt, paper, paper2, tape, tape2, tapeR } = theme;

  const chPT = channels.find(c => c.locale === "pt") || channels[0];
  const chEN = channels.find(c => c.locale === "en") || channels[1];
  const primaryCh = L === "pt" ? chPT : chEN;

  // ---------- URL-state filters ----------
  const readParams = () => {
    const p = new URLSearchParams(window.location.search);
    return {
      cat: p.get("cat") || "latest",
      ch: p.get("ch") || "all",
      tag: p.get("tag") || "",
      q: p.get("q") || "",
    };
  };
  const [filters, setFilters] = React.useState(readParams);
  const [page, setPage] = React.useState(1);
  const PAGE_SIZE = 6;

  React.useEffect(() => {
    const p = new URLSearchParams();
    if (filters.cat !== "latest") p.set("cat", filters.cat);
    if (filters.ch !== "all") p.set("ch", filters.ch);
    if (filters.tag) p.set("tag", filters.tag);
    if (filters.q) p.set("q", filters.q);
    const qs = p.toString();
    const url = window.location.pathname + (qs ? "?" + qs : "") + window.location.hash;
    window.history.replaceState(null, "", url);
  }, [filters]);

  const update = (patch) => { setFilters(f => ({ ...f, ...patch })); setPage(1); };
  const reset = () => { setFilters({ cat: "latest", ch: "all", tag: "", q: "" }); setPage(1); };

  const goToArchive = (patch) => {
    setFilters(f => ({ ...f, ...patch }));
    setPage(1);
    setTimeout(() => {
      const el = document.getElementById("archive");
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - 60, behavior: "smooth" });
    }, 50);
  };

  // ---------- Series + tags ----------
  const seriesList = React.useMemo(() => {
    const seen = new Map();
    vids.forEach(v => {
      const k = v.series_pt;
      if (!seen.has(k)) seen.set(k, { key: k, label: v["series_" + L], count: 1 });
      else seen.get(k).count++;
    });
    return Array.from(seen.values());
  }, [vids, L]);

  const allTags = React.useMemo(() => {
    const counts = {};
    vids.forEach(v => (v.tags || []).forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([tag, n]) => ({ tag, n }));
  }, [vids]);

  // ---------- Filtering ----------
  const filtered = React.useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    let arr = vids.filter(v => {
      if (filters.ch !== "all" && v.locale !== filters.ch) return false;
      if (filters.cat !== "latest" && v.series_pt !== filters.cat) return false;
      if (filters.tag && !(v.tags || []).includes(filters.tag)) return false;
      if (q) {
        const hay = [v["title_" + L], v["desc_" + L], v["series_" + L], v.id, ...(v.tags || [])].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    arr = arr.slice().sort((a, b) => (b.iso > a.iso ? 1 : -1));
    return arr;
  }, [vids, filters, L]);

  const hasFilters = filters.cat !== "latest" || filters.ch !== "all" || filters.tag || filters.q;

  // ---------- Latest by channel ----------
  const sortedAll = React.useMemo(() => vids.slice().sort((a, b) => (b.iso > a.iso ? 1 : -1)), [vids]);
  const latestPT = sortedAll.find(v => v.locale === "pt");
  const latestEN = sortedAll.find(v => v.locale === "en");
  const enOlder = sortedAll.filter(v => v.locale === "en" && v.id !== latestEN?.id).slice(0, 2);

  // "Esta semana" pick: most-recent overall
  const featurePick = sortedAll[0];
  const featureSidekicks = sortedAll.filter(v => v.id !== featurePick?.id).slice(0, 3);

  // ---------- Ads ----------
  const adsCfg = adsConfig || { enabled: true, slots: { bookmark: true, marginalia: true, bowtie: true, doorman: false } };
  const adsEnabled = adsCfg.enabled && window.AdsContent;
  const adSlot = adsCfg.slots || {};
  const sponsorList = adsEnabled ? Object.values(window.AdsContent.sponsors) : [];
  const houseList = adsEnabled ? Object.values(window.AdsContent.houseAds) : [];
  const adH = Math.floor(Date.now() / (1000 * 60 * 60 * 24)) + 4;
  const pickSponsor = (i = 0) => sponsorList.length ? sponsorList[Math.abs(adH + i) % sponsorList.length] : null;
  const pickHouse = (i = 0) => houseList.length ? houseList[Math.abs(adH + i) % houseList.length] : null;
  const adDoorman    = adsEnabled && adSlot.doorman    ? pickHouse(0) : null;
  const adBookmark   = adsEnabled && adSlot.bookmark   ? pickSponsor(0) : null;
  const adMarginalia = adsEnabled && adSlot.marginalia ? pickHouse(1) : null;
  const adBowtie     = adsEnabled && adSlot.bowtie     ? (window.AdsContent && window.AdsContent.houseAds.newsletter) || pickHouse(2) : null;

  // ---------- Nav ----------
  const nav = [
    { key: "home", href: "Pinboard.html", label: t.nav.home },
    { key: "writing", href: "blog.html", label: t.nav.writing },
    { key: "videos", href: "youtube.html", label: t.nav.videos },
    { key: "newsletters", href: "newsletters.html", label: t.nav.newsletter },
    { key: "about", href: "about.html", label: t.nav.about },
    { key: "contact", href: sites.contact.url, label: sites.contact["label_" + L] },
    { key: "dev", href: sites.dev.url, label: sites.dev["label_" + L], external: true },
  ];

  const headerCTAs = (
    <a href={primaryCh.url} target="_blank" rel="noopener" style={{
      padding: "7px 13px",
      background: yt, color: "#FFF",
      border: `1.5px solid ${yt}`,
      fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
      letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700,
      textDecoration: "none",
      display: "inline-flex", alignItems: "center", gap: 5,
    }}>▶ {L === "pt" ? "inscrever" : "subscribe"}</a>
  );

  // ---------- Helpers ----------
  const fmtNum = (n) => {
    if (!n && n !== 0) return "0";
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".", L === "pt" ? "," : ".") + "k";
    return String(n);
  };
  const totalSecs = vids.reduce((acc, v) => {
    const parts = String(v.duration || "0:00").split(":").map(n => parseInt(n, 10) || 0);
    return acc + parts.reduce((a, n) => a * 60 + n, 0);
  }, 0);
  const hoursTotal = (totalSecs / 3600).toFixed(1).replace(".", L === "pt" ? "," : ".");

  // ---------- UI atoms ----------
  const FlagBadge = ({ locale, size = "md" }) => {
    const colors = locale === "pt"
      ? { bg: "rgba(0,156,59,0.18)", border: "rgba(0,156,59,0.5)", flag: "🇧🇷" }
      : { bg: "rgba(0,82,165,0.18)", border: "rgba(0,82,165,0.55)", flag: "🇺🇸" };
    const fontSize = size === "sm" ? 9 : 10;
    const flagSize = size === "sm" ? 11 : 12;
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: size === "sm" ? "1px 6px" : "2px 7px",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        fontFamily: '"JetBrains Mono", monospace', fontSize,
        letterSpacing: "0.1em", color: ink, fontWeight: 600,
      }}>
        <span style={{ fontSize: flagSize, lineHeight: 1 }}>{colors.flag}</span>
        {locale.toUpperCase()}
      </span>
    );
  };

  const Kicker = ({ num, label, color }) => (
    <div style={{
      fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
      letterSpacing: "0.2em", textTransform: "uppercase",
      color: color || yt, marginBottom: 12,
    }}>
      § {num} · {label}
    </div>
  );

  const Stat = ({ icon, v }) => (
    <span style={{
      fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
      color: muted, letterSpacing: "0.04em",
      display: "inline-flex", gap: 5, alignItems: "center",
    }}>
      <span style={{ color: yt, fontSize: 10 }}>{icon}</span>
      {v}
    </span>
  );

  // ---------- Hero ----------
  // PT layout: editorial split — left col is BIG title + meta + 3 lines of latest-PT,
  //   right col is the latest-EN as compact preview ("também rolou em inglês essa semana")
  // EN layout: big latest video card + 2 sidekicks below
  const HeroPT = () => (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "56px 28px 28px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 56, alignItems: "start" }} className="keep-2col">
        {/* Left: editorial title + featured PT */}
        <div>
          <Kicker num="01" label={L === "pt" ? "esta semana, em dois canais" : "this week, on two channels"}/>
          <h1 style={{
            fontFamily: '"Fraunces", serif', fontSize: "clamp(44px, 5.6vw, 78px)",
            margin: 0, fontWeight: 500,
            letterSpacing: "-0.035em", lineHeight: 0.96, position: "relative", display: "inline",
            textWrap: "balance", color: ink,
          }}>
            Dois canais,
            <br/>
            <span style={{ position: "relative", display: "inline-block" }}>
              uma cabeça
              <span style={{
                position: "absolute", bottom: 4, left: -6, right: -6, height: 18,
                background: marker, zIndex: -1, opacity: 0.7, transform: "skew(-2deg)",
              }}/>
            </span>
            <span style={{ ...hand, fontSize: 38, marginLeft: 12, color: yt, transform: "rotate(-4deg)", display: "inline-block", verticalAlign: "middle" }}>▶</span>
          </h1>
          <p style={{ fontSize: 17, color: muted, marginTop: 22, maxWidth: 540, lineHeight: 1.55, fontFamily: '"Source Serif 4", Georgia, serif' }}>
            Um canal em português, um em inglês — saídos da mesma mesa. PT é onde eu falo de carreira, setup, retrospectivas. EN é onde eu codifico em público.
          </p>

          {/* Latest PT — wide card with title + meta */}
          {latestPT && (
            <a href={"#" + latestPT.id} style={{
              display: "block", textDecoration: "none", color: "inherit",
              marginTop: 36, position: "relative", paddingTop: 14,
            }}>
              <Paper tint={paper} pad="0" rotation={-0.3}>
                <Tape color={tape} style={{ top: -10, left: "10%", transform: "rotate(-3deg)", width: 90 }}/>
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 0 }}>
                  <div style={{ position: "relative" }}>
                    <VideoThumb v={latestPT} aspect="16/10" size="md"/>
                  </div>
                  <div style={{ padding: "16px 20px 18px" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <FlagBadge locale="pt" size="sm"/>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint, letterSpacing: "0.06em" }}>
                        {latestPT["date_" + L]}
                      </span>
                    </div>
                    <h2 style={{
                      fontFamily: '"Fraunces", serif', fontSize: 22, margin: "2px 0 8px", fontWeight: 500,
                      lineHeight: 1.18, letterSpacing: "-0.012em", color: ink, textWrap: "balance",
                    }}>
                      {latestPT["title_" + L]}
                    </h2>
                    <p style={{ fontSize: 13, lineHeight: 1.5, color: muted, fontFamily: '"Source Serif 4", Georgia, serif', margin: "0 0 10px" }}>
                      {latestPT["desc_" + L]}
                    </p>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      <Stat icon="▶" v={latestPT["views_" + L]}/>
                      <Stat icon="♥" v={fmtNum(latestPT.likes)}/>
                    </div>
                  </div>
                </div>
              </Paper>
            </a>
          )}
        </div>

        {/* Right: latest EN as compact "outro canal" preview */}
        <div style={{ paddingTop: 28 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
            fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
            letterSpacing: "0.18em", textTransform: "uppercase", color: faint,
          }}>
            <FlagBadge locale="en" size="sm"/>
            <span>{L === "pt" ? "também rolou no @thiagofigueiredo" : "also on @thiagofigueiredo"}</span>
          </div>

          {latestEN && (
            <a href={"#" + latestEN.id} style={{ textDecoration: "none", color: "inherit", display: "block", position: "relative", paddingTop: 14 }}>
              <Paper tint={paper2} pad="0" rotation={0.4}>
                <Tape color={tapeR} style={{ top: -10, left: "60%", transform: "rotate(4deg)", width: 80 }}/>
                <VideoThumb v={latestEN} aspect="16/9" size="md"/>
                <div style={{ padding: "14px 18px 16px" }}>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint, marginBottom: 6, letterSpacing: "0.06em" }}>
                    {latestEN["date_" + L]} · {latestEN["views_" + L]}
                  </div>
                  <h3 style={{
                    fontFamily: '"Fraunces", serif', fontSize: 17, margin: "2px 0 6px", fontWeight: 500,
                    lineHeight: 1.22, letterSpacing: "-0.005em", color: ink, textWrap: "balance",
                  }}>
                    {latestEN["title_" + L]}
                  </h3>
                  <p style={{ fontSize: 12, lineHeight: 1.5, color: muted, fontFamily: '"Source Serif 4", Georgia, serif', margin: 0 }}>
                    {latestEN["desc_" + L]}
                  </p>
                </div>
              </Paper>
            </a>
          )}

          {/* Mini list — 2 prev EN videos as plain links */}
          <div style={{ marginTop: 22, paddingTop: 18, borderTop: `1px dashed ${line}` }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
              letterSpacing: "0.2em", textTransform: "uppercase", color: faint, marginBottom: 12,
            }}>
              {L === "pt" ? "anteriores em inglês" : "previously in English"}
            </div>
            {enOlder.map((v, i) => (
              <a key={v.id} href={"#" + v.id} style={{
                display: "flex", justifyContent: "space-between", gap: 12,
                padding: "10px 0", borderBottom: i < enOlder.length - 1 ? `1px dashed ${line}` : "none",
                textDecoration: "none", color: "inherit",
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontFamily: '"Fraunces", serif', fontSize: 14, fontWeight: 500, color: ink,
                    lineHeight: 1.25, letterSpacing: "-0.005em",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {v["title_" + L]}
                  </div>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: faint, marginTop: 4, letterSpacing: "0.06em" }}>
                    {v["date_" + L]} · {v.duration}
                  </div>
                </div>
                <span style={{ color: yt, fontSize: 14, alignSelf: "center" }}>↗</span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  const HeroEN = () => (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "56px 28px 28px" }}>
      <Kicker num="01" label={L === "pt" ? "último vídeo" : "latest video"}/>
      <h1 style={{
        fontFamily: '"Fraunces", serif', fontSize: "clamp(44px, 5.4vw, 72px)",
        margin: "0 0 16px", fontWeight: 500,
        letterSpacing: "-0.035em", lineHeight: 0.98, display: "inline-block",
        textWrap: "balance", position: "relative",
      }}>
        {L === "pt" ? "Live-coding," : "Live-coding,"}
        <br/>
        <span style={{ position: "relative", display: "inline-block" }}>
          {L === "pt" ? "em inglês." : "in English."}
          <span style={{
            position: "absolute", bottom: 4, left: -6, right: -6, height: 18,
            background: marker, zIndex: -1, opacity: 0.7, transform: "skew(-2deg)",
          }}/>
        </span>
      </h1>
      <p style={{ fontSize: 17, color: muted, marginTop: 12, maxWidth: 720, lineHeight: 1.55, fontFamily: '"Source Serif 4", Georgia, serif' }}>
        {L === "pt"
          ? "@thiagofigueiredo — onde eu codifico em público, em inglês. Tem um canal-irmão em português, lá em cima."
          : "@thiagofigueiredo — where I code in public, in English. There's a sister channel in Portuguese, linked above."}
      </p>

      {latestEN && (
        <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: "2fr 1fr", gap: 28 }}>
          <a href={"#" + latestEN.id} style={{ textDecoration: "none", color: "inherit", display: "block", position: "relative", paddingTop: 16 }}>
            <Paper tint={paper2} pad="0" rotation={-0.3}>
              <Tape color={tapeR} style={{ top: -10, left: "44%", transform: "rotate(-4deg)", width: 100 }}/>
              <VideoThumb v={latestEN} aspect="16/9" size="lg"/>
              <div style={{ padding: "20px 24px 22px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                  <FlagBadge locale="en" size="sm"/>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint }}>
                    {latestEN["date_" + L]}
                  </span>
                </div>
                <h2 style={{
                  fontFamily: '"Fraunces", serif', fontSize: 30, margin: "4px 0 10px", fontWeight: 500,
                  lineHeight: 1.14, letterSpacing: "-0.014em", color: ink, textWrap: "balance",
                }}>
                  {latestEN["title_" + L]}
                </h2>
                <p style={{ fontSize: 15, lineHeight: 1.55, color: muted, fontFamily: '"Source Serif 4", Georgia, serif', margin: 0 }}>
                  {latestEN["desc_" + L]}
                </p>
                <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
                  <Stat icon="▶" v={latestEN["views_" + L]}/>
                  <Stat icon="♥" v={fmtNum(latestEN.likes)}/>
                  <Stat icon="✎" v={String(latestEN.comments)}/>
                </div>
              </div>
            </Paper>
          </a>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 16 }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: faint, paddingBottom: 8, borderBottom: `1px dashed ${line}` }}>
              {L === "pt" ? "anteriores" : "previously"}
            </div>
            {enOlder.map((v, i) => <SidekickItem key={v.id} v={v} index={i}/>)}
          </div>
        </div>
      )}
    </section>
  );

  const SidekickItem = ({ v, index }) => (
    <a href={"#" + v.id} style={{
      display: "grid", gridTemplateColumns: "100px 1fr", gap: 12,
      textDecoration: "none", color: "inherit",
      padding: 8, border: `1px dashed ${line}`,
    }}>
      <div style={{
        position: "relative", aspectRatio: "16/9",
        ...window.postImg({ h: v.thumb.h, h2: v.thumb.h2, pattern: "grid" }, { dark }),
      }}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 28, height: 20, background: yt, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
        <div style={{ position: "absolute", bottom: 3, right: 3, background: "rgba(0,0,0,0.85)", color: "#FFF", fontFamily: '"JetBrains Mono", monospace', fontSize: 9, padding: "1px 4px" }}>{v.duration}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: faint, letterSpacing: "0.08em", marginBottom: 4 }}>
          {v["date_" + L]} · {v["views_" + L]}
        </div>
        <div style={{
          fontFamily: '"Fraunces", serif', fontSize: 14.5, lineHeight: 1.2, color: ink, fontWeight: 500, letterSpacing: "-0.005em",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {v["title_" + L]}
        </div>
      </div>
    </a>
  );

  // ---------- Channel duplex strip ----------
  const ChannelStrip = () => (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "8px 28px 0" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="keep-2col">
        {channels.map(c => (
          <a key={c.url} href={c.url} target="_blank" rel="noopener" style={{
            textDecoration: "none", color: "inherit",
            display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 16,
            alignItems: "center", padding: "16px 20px",
            border: `1.5px solid ${line}`, background: "transparent",
            transition: "background 0.15s, border-color 0.15s",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = paper; e.currentTarget.style.borderColor = yt; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = line; }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: "50%",
              background: c.locale === "pt" ? "linear-gradient(135deg,#009C3B,#FEDF00)" : "linear-gradient(135deg,#0052A5,#BF0A30)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, color: "#FFF", boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
            }}>
              {c.flag}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: '"Fraunces", serif', fontSize: 17, fontWeight: 500, color: ink, letterSpacing: "-0.005em" }}>
                {c.name}
              </div>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: muted, marginTop: 4, letterSpacing: "0.06em" }}>
                {c["subs_" + L]} · {c["videos_" + L]} · {c["schedule_" + L]}
              </div>
            </div>
            <span style={{
              padding: "6px 11px", background: yt, color: "#FFF",
              fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
              letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap",
            }}>▶ {L === "pt" ? "abrir" : "open"}</span>
          </a>
        ))}
      </div>
    </section>
  );

  // ---------- Stats strip — real metrics ----------
  // Real: total videos, total runtime, comments responded (a number you can defend),
  //   most-watched single video.
  const StatsStrip = () => {
    const mostWatched = sortedAll.slice().sort((a, b) => {
      const num = (s) => parseFloat(String(s).replace(/[^0-9.,]/g, "").replace(",", ".")) || 0;
      return num(b["views_" + L]) - num(a["views_" + L]);
    })[0];
    const totalComments = vids.reduce((acc, v) => acc + (v.comments || 0), 0);
    const stats = [
      { k: L === "pt" ? "vídeos publicados" : "videos published", v: String(vids.length) },
      { k: L === "pt" ? "horas de conteúdo" : "hours of content", v: hoursTotal + " h" },
      { k: L === "pt" ? "comentários respondidos" : "comments answered", v: fmtNum(totalComments) },
      { k: L === "pt" ? "mais assistido" : "most watched", v: mostWatched ? mostWatched["views_" + L].split(" ")[0] : "—" },
    ];
    return (
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 28px 0" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0,
          padding: "22px 0",
          borderTop: `1px dashed ${line}`, borderBottom: `1px dashed ${line}`,
        }}>
          {stats.map((s, i) => (
            <div key={i} style={{
              padding: "0 24px",
              borderRight: i < 3 ? `1px dashed ${line}` : "none",
              position: "relative",
            }}>
              <div style={{
                fontFamily: '"Fraunces", serif', fontSize: 32, fontWeight: 500,
                color: ink, letterSpacing: "-0.014em", lineHeight: 1.05,
              }}>{s.v}</div>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                letterSpacing: "0.16em", textTransform: "uppercase", color: faint,
                marginTop: 8,
              }}>{s.k}</div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  // ---------- Esta semana — single editorial pick + 3 sidekicks ----------
  const FeatureBlock = () => {
    if (!featurePick) return null;
    return (
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "80px 28px 0" }}>
        <Kicker num="02" label={L === "pt" ? "esta semana, em destaque" : "this week's pick"} color={accent}/>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{
            fontFamily: '"Fraunces", serif', fontSize: 40, margin: 0, fontWeight: 500,
            letterSpacing: "-0.022em", textWrap: "balance",
          }}>
            {L === "pt" ? "O que vale a pena reservar 20 minutos" : "What's worth setting aside 20 minutes for"}
          </h2>
          <span style={{ ...hand, fontSize: 18, color: yt, transform: "rotate(-1.5deg)" }}>
            {L === "pt" ? "↓ minha escolha" : "↓ my pick"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 32, alignItems: "start" }} className="keep-2col">
          {/* Big featured */}
          <a href={"#" + featurePick.id} style={{ textDecoration: "none", color: "inherit", display: "block", position: "relative", paddingTop: 18 }}>
            <Paper tint={paper} pad="0" rotation={-0.3}>
              <Tape color={tape2} style={{ top: -10, left: "30%", transform: "rotate(-3deg)", width: 100 }}/>
              <VideoThumb v={featurePick} aspect="16/9" size="lg"/>
              <div style={{ padding: "22px 26px 24px" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                  <FlagBadge locale={featurePick.locale} size="sm"/>
                  <span style={{ padding: "2px 7px", background: accent, color: "#FFF", fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
                    {featurePick["series_" + L]}
                  </span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: faint }}>
                    · {featurePick["date_" + L]} · {featurePick.duration}
                  </span>
                </div>
                <h3 style={{
                  fontFamily: '"Fraunces", serif', fontSize: 28, margin: "4px 0 12px", fontWeight: 500,
                  lineHeight: 1.16, letterSpacing: "-0.014em", color: ink, textWrap: "balance",
                }}>
                  {featurePick["title_" + L]}
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: muted, fontFamily: '"Source Serif 4", Georgia, serif', margin: 0 }}>
                  {featurePick["desc_" + L]}
                </p>
                <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
                  <Stat icon="▶" v={featurePick["views_" + L]}/>
                  <Stat icon="♥" v={fmtNum(featurePick.likes)}/>
                  <Stat icon="✎" v={String(featurePick.comments)}/>
                </div>
              </div>
            </Paper>
          </a>

          {/* 3 mini cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 18 }}>
            <div style={{
              fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.2em",
              textTransform: "uppercase", color: faint, paddingBottom: 8, borderBottom: `1px dashed ${line}`,
            }}>
              {L === "pt" ? "também rolaram" : "also dropped"}
            </div>
            {featureSidekicks.map((v, i) => (
              <a key={v.id} href={"#" + v.id} style={{
                display: "grid", gridTemplateColumns: "120px 1fr", gap: 14,
                textDecoration: "none", color: "inherit",
                padding: "10px 6px", border: `1px solid transparent`,
                transition: "background 0.15s, border-color 0.15s",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = paper; e.currentTarget.style.borderColor = line; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
              >
                <div style={{
                  position: "relative", aspectRatio: "16/9",
                  ...window.postImg({ h: v.thumb.h, h2: v.thumb.h2, pattern: "grid" }, { dark }),
                }}>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 30, height: 22, background: yt, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                  </div>
                  <div style={{ position: "absolute", bottom: 3, right: 3, background: "rgba(0,0,0,0.85)", color: "#FFF", fontFamily: '"JetBrains Mono", monospace', fontSize: 9, padding: "1px 4px" }}>{v.duration}</div>
                  <div style={{ position: "absolute", top: 3, left: 3 }}>
                    <FlagBadge locale={v.locale} size="sm"/>
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: faint, letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>
                    {v["series_" + L]} · {v["date_" + L]}
                  </div>
                  <div style={{
                    fontFamily: '"Fraunces", serif', fontSize: 15.5, lineHeight: 1.22, color: ink, fontWeight: 500, letterSpacing: "-0.008em",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                  }}>
                    {v["title_" + L]}
                  </div>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: muted, marginTop: 6, letterSpacing: "0.04em" }}>
                    {v["views_" + L]} · ♥ {fmtNum(v.likes)}
                  </div>
                </div>
              </a>
            ))}

            {/* Series shortcut chips */}
            <div style={{ paddingTop: 14, marginTop: 4, borderTop: `1px dashed ${line}` }}>
              <div style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, letterSpacing: "0.18em",
                textTransform: "uppercase", color: faint, marginBottom: 10,
              }}>
                {L === "pt" ? "ir direto pra uma série" : "jump to a series"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {seriesList.map(s => (
                  <button key={s.key} onClick={() => goToArchive({ cat: s.key })} style={{
                    padding: "5px 9px",
                    background: "transparent", color: ink,
                    border: `1px solid ${line}`,
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                    letterSpacing: "0.06em", cursor: "pointer", display: "inline-flex", gap: 5, alignItems: "center",
                  }}>
                    ▶ {s.label} <span style={{ color: faint, fontSize: 9 }}>{s.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  // ---------- Comments wall — 4 strongest ----------
  const CommentsWall = () => {
    const top = allComments.slice().sort((a, b) => b.likes - a.likes).slice(0, 4);
    return (
      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "92px 28px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 60, alignItems: "start" }} className="keep-2col">
          <div>
            <Kicker num="03" label={L === "pt" ? "o que disseram" : "what people said"} color={yt}/>
            <h2 style={{
              fontFamily: '"Fraunces", serif', fontSize: 36, margin: "0 0 14px", fontWeight: 500,
              letterSpacing: "-0.022em", textWrap: "balance", color: ink, lineHeight: 1.1,
            }}>
              {L === "pt" ? "Recortes que me fizeram parar e reler" : "Clippings that made me stop and re-read"}
            </h2>
            <p style={{ fontSize: 14.5, color: muted, fontFamily: '"Source Serif 4", Georgia, serif', maxWidth: 360, margin: 0, lineHeight: 1.55 }}>
              {L === "pt"
                ? "Selecionados à mão. Não é automático — eu leio cada um."
                : "Hand-picked. Not automated — I read every single one."}
            </p>
            <div style={{ ...hand, fontSize: 22, color: yt, transform: "rotate(-3deg)", marginTop: 32, display: "inline-block" }}>
              {L === "pt" ? "→ chega de scroll" : "→ enough scrolling"}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, alignItems: "start" }}>
            {top.map((c, i) => {
              const v = vids.find(x => x.id === c.vid);
              if (!v) return null;
              const tilt = (i % 4 - 1.5) * 0.7;
              return (
                <div key={c.author + c.vid} style={{ position: "relative", paddingTop: 14 }}>
                  <Paper tint={i % 2 ? paper2 : paper} pad="0" rotation={tilt}>
                    <Tape color={i % 3 === 0 ? tape : i % 3 === 1 ? tape2 : tapeR}
                          style={{ top: -10, left: i % 2 ? "20%" : "62%", transform: `rotate(${(i * 11) % 14 - 7}deg)`, width: 80 }}/>
                    <div style={{ padding: "20px 22px 18px" }}>
                      {/* Author */}
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%",
                          ...window.postImg({ h: c.avatar_h, h2: c.avatar_h + 30, pattern: "dots" }, { dark }),
                          flexShrink: 0,
                          border: `1.5px solid ${c.channel_locale === "pt" ? "rgba(0,156,59,0.6)" : "rgba(0,82,165,0.6)"}`,
                        }}/>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600, color: ink, letterSpacing: "0.02em" }}>
                            @{c.author}
                          </div>
                          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: faint, marginTop: 2, letterSpacing: "0.06em", display: "flex", gap: 6, alignItems: "center" }}>
                            {c["time_" + L]} · <FlagBadge locale={c.channel_locale} size="sm"/>
                          </div>
                        </div>
                      </div>

                      {/* Quote */}
                      <div style={{
                        fontFamily: '"Fraunces", serif', fontSize: 18, lineHeight: 1.42,
                        color: ink, marginBottom: 16, letterSpacing: "-0.008em",
                        fontStyle: "italic", position: "relative", paddingLeft: 18,
                      }}>
                        <span style={{
                          position: "absolute", left: 0, top: -6,
                          fontSize: 36, color: yt, fontFamily: 'Georgia, serif',
                          lineHeight: 1, opacity: 0.8,
                        }}>“</span>
                        {c["text_" + L]}
                      </div>

                      {/* Footer */}
                      <a href={"#" + v.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        paddingTop: 12, borderTop: `1px dashed ${line}`,
                        textDecoration: "none", color: "inherit",
                      }}>
                        <span style={{
                          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                          color: muted, letterSpacing: "0.04em",
                          display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden",
                        }}>
                          ▶ {v["title_" + L]}
                        </span>
                        <span style={{
                          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                          color: yt, fontWeight: 600, marginLeft: 10, whiteSpace: "nowrap",
                        }}>
                          ♥ {fmtNum(c.likes)}
                        </span>
                      </a>
                    </div>
                  </Paper>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  // ---------- Filter / archive ----------
  const FilterBar = () => (
    <section id="archive" style={{ maxWidth: 1280, margin: "0 auto", padding: "92px 28px 0", scrollMarginTop: 60 }}>
      <Kicker num="04" label={L === "pt" ? "arquivo" : "archive"} color={accent}/>
      <h2 style={{
        fontFamily: '"Fraunces", serif', fontSize: 40, margin: "0 0 28px", fontWeight: 500,
        letterSpacing: "-0.022em", lineHeight: 1.05,
      }}>
        {L === "pt" ? `Tudo que tá no canal` : `Everything on the channel`}
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 18, color: faint, marginLeft: 14, fontWeight: 400, letterSpacing: "0.04em" }}>
          [{vids.length}]
        </span>
      </h2>

      {/* Search + clear */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 440 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: faint }}>⌕</span>
          <input
            type="text"
            value={filters.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder={L === "pt" ? "buscar título, tag, série…" : "search title, tag, series…"}
            style={{
              width: "100%", padding: "12px 14px 12px 36px",
              border: `1.5px solid ${line}`, background: "transparent", color: ink,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 13, outline: "none",
            }}
          />
        </div>

        {/* Channel filter — both locales */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: faint, marginRight: 4 }}>
            {L === "pt" ? "canal:" : "channel:"}
          </span>
          {[
            { k: "all", l: L === "pt" ? "Ambos" : "Both", flag: "🌐" },
            { k: "pt", l: "PT", flag: "🇧🇷" },
            { k: "en", l: "EN", flag: "🇺🇸" },
          ].map(({ k, l, flag }) => {
            const active = filters.ch === k;
            return (
              <button key={k} onClick={() => update({ ch: k })} style={{
                padding: "5px 10px", fontSize: 10,
                background: active ? ink : "transparent",
                color: active ? (dark ? "#141210" : "#FBF6E8") : muted,
                border: `1px solid ${active ? ink : line}`,
                fontFamily: '"JetBrains Mono", monospace',
                letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                <span>{flag}</span> {l}
              </button>
            );
          })}
        </div>

        {hasFilters && (
          <button onClick={reset} style={{
            padding: "5px 10px", fontSize: 10,
            background: "transparent", color: yt,
            border: `1px dashed ${yt}`, marginLeft: "auto",
            fontFamily: '"JetBrains Mono", monospace',
            letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
          }}>
            ✕ {L === "pt" ? "limpar tudo" : "clear all"}
          </button>
        )}
      </div>

      {/* Series chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "center" }}>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: faint, marginRight: 4 }}>
          {L === "pt" ? "série:" : "series:"}
        </span>
        {[{ key: "latest", label: "Latest", count: vids.length }, ...seriesList].map(({ key, label, count }) => {
          const active = filters.cat === key;
          return (
            <button key={key} onClick={() => update({ cat: key })} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "7px 13px",
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
              letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s",
              background: active ? yt : "transparent",
              color: active ? "#FFF" : ink,
              border: `1.5px solid ${active ? yt : line}`,
              transform: active ? `rotate(${((String(key).charCodeAt(0) || 0) % 3 - 1) * 0.6}deg)` : "none",
            }}>
              {key === "latest" ? "★" : "▶"} {label}
              <span style={{
                fontSize: 10, opacity: active ? 0.85 : 0.55,
                padding: "1px 5px",
                background: active ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.06)",
                fontWeight: 500,
              }}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Tags */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 30, paddingBottom: 26, borderBottom: `1px dashed ${line}`, alignItems: "center" }}>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: faint, marginRight: 4 }}>
          tags:
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
            }}>
              #{tag}
              <span style={{ fontSize: 9, opacity: active ? 0.8 : 0.5 }}>{n}</span>
            </button>
          );
        })}
      </div>
    </section>
  );

  // ---------- Custom card with flag badge inline ----------
  const ArchiveCard = ({ v, index }) => (
    <div style={{ position: "relative", paddingTop: 16 }}>
      <Paper tint={paper} pad="12px 12px 18px" rotation={theme.rot(index + 11)} y={theme.lift(index + 11)}>
        <Tape color={tapeR} style={{ top: -9, left: "40%", transform: `rotate(${(index * 7) % 10 - 5}deg)` }}/>
        <a href={"#" + v.id} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <div style={{ position: "relative" }}>
            <VideoThumb v={v} aspect="16/9"/>
            <div style={{ position: "absolute", top: 8, right: 8 }}>
              <FlagBadge locale={v.locale} size="sm"/>
            </div>
          </div>
          <div style={{ paddingTop: 14, paddingLeft: 4, paddingRight: 4 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{
                padding: "2px 7px", background: yt, color: "#FFF",
                fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
                letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700,
              }}>
                {v["series_" + L]}
              </span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: faint, letterSpacing: "0.06em" }}>
                {v["date_" + L]}
              </span>
            </div>
            <h3 style={{
              fontFamily: '"Fraunces", serif', fontSize: 18, margin: "4px 0 8px", fontWeight: 500,
              lineHeight: 1.22, letterSpacing: "-0.008em", color: ink, textWrap: "balance",
            }}>
              {v["title_" + L]}
            </h3>
            <p style={{ fontSize: 12.5, lineHeight: 1.5, color: muted, fontFamily: '"Source Serif 4", Georgia, serif', margin: "0 0 10px" }}>
              {v["desc_" + L]}
            </p>
            <div style={{ display: "flex", gap: 12, fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: muted, letterSpacing: "0.04em", flexWrap: "wrap" }}>
              <span>{v.duration}</span>
              <span>·</span>
              <span>{v["views_" + L]}</span>
            </div>
            {v.tags && v.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                {v.tags.slice(0, 3).map(tag => (
                  <span key={tag} style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: faint, letterSpacing: "0.04em",
                    padding: "2px 6px", background: "rgba(0,0,0,0.04)",
                  }}>#{tag}</span>
                ))}
              </div>
            )}
          </div>
        </a>
      </Paper>
    </div>
  );

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const moreLeft = filtered.length > visible.length;

  // ---------- Subscribe duplex ----------
  const SubscribeBlock = () => (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "92px 28px 40px" }}>
      <div style={{
        position: "relative",
        background: dark ? "rgba(255,51,51,0.07)" : "rgba(255,51,51,0.05)",
        border: `1.5px solid ${yt}`,
        padding: "48px 36px 40px",
        textAlign: "center",
      }}>
        <span style={{
          position: "absolute", top: -14, left: "50%", transform: "translateX(-50%) rotate(-1deg)",
          padding: "5px 14px", background: yt, color: "#FFF",
          fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
          letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
        }}>
          ▶ {L === "pt" ? "se inscreva" : "subscribe"}
        </span>
        <h2 style={{
          fontFamily: '"Fraunces", serif', fontSize: 40, margin: "0 0 12px", fontWeight: 500,
          letterSpacing: "-0.025em", textWrap: "balance", lineHeight: 1.05,
        }}>
          {L === "pt" ? "Assistir é grátis. Voltar é o difícil." : "Watching is free. Coming back is the hard part."}
        </h2>
        <p style={{ fontSize: 15, color: muted, marginBottom: 32, maxWidth: 600, margin: "0 auto 32px", fontFamily: '"Source Serif 4", Georgia, serif', lineHeight: 1.55 }}>
          {L === "pt"
            ? "Inscreva-se nos dois — o feed do YouTube cuida do resto. PT é onde eu falo de carreira e setup; EN é onde eu codifico em público."
            : "Subscribe to both — the YouTube feed takes care of the rest. PT covers career and setup; EN is live-coding."}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 720, margin: "0 auto" }} className="keep-2col">
          {channels.map(c => (
            <a key={c.url} href={c.url} target="_blank" rel="noopener" style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              padding: "22px 16px", textDecoration: "none", color: "inherit",
              background: paper, border: `1px solid ${line}`,
              transition: "transform 0.15s, border-color 0.15s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = yt; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = line; }}
            >
              <div style={{ fontSize: 32 }}>{c.flag}</div>
              <div style={{ fontFamily: '"Fraunces", serif', fontSize: 17, fontWeight: 500, color: ink }}>
                {c.name}
              </div>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: muted, letterSpacing: "0.06em", textAlign: "center", lineHeight: 1.5 }}>
                {c["subs_" + L]}<br/>{c["schedule_" + L]}
              </div>
              <span style={{
                marginTop: 6, padding: "8px 16px",
                background: yt, color: "#FFF",
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
                letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700,
              }}>
                ▶ {L === "pt" ? "inscrever" : "subscribe"}
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );

  // ---------- Render ----------
  return (
    <div id="top" style={{ background: bg, color: ink, minHeight: "100vh", fontFamily: '"Inter", sans-serif' }}>
      {adDoorman && <window.Doorman ad={adDoorman} L={L} theme={theme}/>}

      <PageHeader nav={nav} current="videos" ctas={headerCTAs}/>

      {/* Hero — locale-adaptive */}
      {L === "pt" ? <HeroPT/> : <HeroEN/>}

      <ChannelStrip/>
      <StatsStrip/>
      <FeatureBlock/>

      {/* Bookmark sponsor — between Feature and Comments */}
      {adBookmark && (
        <div style={{ maxWidth: 760, margin: "60px auto 0", padding: "0 28px" }}>
          <window.Bookmark ad={adBookmark} L={L} theme={theme}/>
        </div>
      )}

      <CommentsWall/>

      {adMarginalia && (
        <section style={{ maxWidth: 720, margin: "70px auto 0", padding: "0 28px" }}>
          <window.Marginalia ad={adMarginalia} L={L} theme={theme} variant="paper"/>
        </section>
      )}

      <FilterBar/>

      <section style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: muted, letterSpacing: "0.06em" }}>
            <span style={{ color: ink, fontWeight: 600 }}>{filtered.length}</span>
            {" "}
            {filtered.length === 1 ? (L === "pt" ? "vídeo" : "video") : (L === "pt" ? "vídeos" : "videos")}
            {hasFilters && <span style={{ color: faint, marginLeft: 8 }}>· {L === "pt" ? "filtrado" : "filtered"}</span>}
          </div>
          {!hasFilters && (
            <div style={{ ...hand, fontSize: 17, color: yt, transform: "rotate(-1deg)" }}>
              ↓ {L === "pt" ? "do mais novo pro mais antigo" : "newest first"}
            </div>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: "80px 0", textAlign: "center" }}>
            <div style={{ ...hand, fontSize: 32, color: muted, marginBottom: 12 }}>
              {L === "pt" ? "nenhum vídeo." : "no videos."}
            </div>
            <button onClick={reset} style={{
              padding: "10px 22px", background: yt, color: "#FFF", border: "none",
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
              letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
            }}>
              {L === "pt" ? "limpar filtros" : "clear filters"}
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32, rowGap: 48 }}>
              {visible.map((v, i) => <ArchiveCard key={v.id} v={v} index={i}/>)}
            </div>
            {moreLeft && (
              <div style={{ textAlign: "center", marginTop: 56 }}>
                <button onClick={() => setPage(p => p + 1)} style={{
                  padding: "12px 28px",
                  background: "transparent", color: yt,
                  border: `1.5px solid ${yt}`,
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
                  letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
                  transition: "background 0.15s, color 0.15s",
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = yt; e.currentTarget.style.color = "#FFF"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = yt; }}
                >
                  ▼ {L === "pt" ? "carregar mais" : "load more"} ({filtered.length - visible.length})
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Bowtie — quiet variant (paper, not orange) so it doesn't fight subscribe */}
      {adBowtie && (
        <section style={{ maxWidth: 920, margin: "56px auto 0", padding: "0 28px" }}>
          <window.Bowtie ad={adBowtie} L={L} theme={theme} variant="quiet"/>
        </section>
      )}

      <SubscribeBlock/>

      {/* Footer */}
      <footer style={{ borderTop: `1px dashed ${line}`, padding: "28px", textAlign: "center", color: faint, fontSize: 12, fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.08em" }}>
        <a href="Pinboard.html" style={{ color: accent, textDecoration: "none" }}>← {L === "pt" ? "voltar pra home" : "back to home"}</a>
        <span style={{ margin: "0 16px", opacity: 0.5 }}>·</span>
        <a href="blog.html" style={{ color: muted, textDecoration: "none" }}>{L === "pt" ? "escritos →" : "writing →"}</a>
        <span style={{ margin: "0 16px", opacity: 0.5 }}>·</span>
        <a href="newsletters.html" style={{ color: muted, textDecoration: "none" }}>{L === "pt" ? "newsletters →" : "newsletters →"}</a>
      </footer>
    </div>
  );
};

window.YouTubePage = YouTubePage;
