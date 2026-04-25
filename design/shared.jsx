/*
 * Shared primitives used by Pinboard + hub pages (blog, videos).
 * Exposes globals via Object.assign(window, {...}) at the bottom.
 */

// ---------- Image / gradient helpers ----------

const PostImg = ({ post, dark, className, style, tall, children }) => {
  const img = post.img || { h: 30, h2: 80, pattern: "blur" };
  const bg = window.postImg(img, { dark, tall });
  const patternColor = dark ? "#F2EBDB" : "#1A1410";
  return (
    <div
      className={className}
      style={{
        position: "relative", overflow: "hidden",
        ...bg,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 400 300" preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
        dangerouslySetInnerHTML={{
          __html:
            "<defs>" + window.postPattern(img.pattern, patternColor) + "</defs>" +
            "<rect width=\"400\" height=\"300\" fill=\"url(#p" + img.pattern + ")\"/>"
        }}
      />
      {children}
    </div>
  );
};

const CatTag = ({ cat, dark, size = "sm", style = {} }) => {
  const c = window.CONTENT.categories[cat];
  if (!c) return null;
  const color = c.color;
  const fs = size === "xs" ? 10 : size === "md" ? 12 : 11;
  return (
    <span style={{
      fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      fontSize: fs, letterSpacing: "0.14em", textTransform: "uppercase",
      color, fontWeight: 500,
      ...style,
    }}>
      {c[window._lang]}
    </span>
  );
};

const PostMeta = ({ post, muted, t, sep = "·" }) => (
  <span style={{
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    fontSize: 11, color: muted, letterSpacing: "0.04em",
  }}>
    {post["date_" + window._lang]} <span style={{ opacity: 0.5 }}>{sep}</span> {post.read} {t.min_read}
  </span>
);

// Brand mark — "Marginalia" direction:
// "by Thiago Figueiredo" with a custom 6-petal asterisk in the accent color.
// Inlined SVG so it works everywhere without a logo dependency.
const MargAsterisk = ({ color, size = 14 }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    style={{ display: "inline-block", verticalAlign: "baseline" }}
    aria-hidden="true"
  >
    <g fill={color}>
      {[0, 60, 120].map((deg) => (
        <path
          key={deg}
          d="M 12 1 C 10.2 5, 10.2 19, 12 23 C 13.8 19, 13.8 5, 12 1 Z"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
      <circle cx="12" cy="12" r="0.81" fill={color} />
    </g>
  </svg>
);

const Brand = ({ ink, accent, size = 22, style = {} }) => {
  const fs = size;
  return (
    <a href="Pinboard.html" style={{
      fontFamily: '"Source Serif 4", Georgia, serif',
      color: ink, textDecoration: "none",
      display: "inline-flex", alignItems: "baseline",
      gap: fs * 0.18, lineHeight: 1, letterSpacing: "-0.015em",
      ...style,
    }} aria-label="by Thiago Figueiredo">
      <span style={{
        fontSize: fs * 0.72,
        fontWeight: 300,
        fontStyle: "italic",
        opacity: 0.75,
        marginRight: -fs * 0.02,
        transform: `translateY(-${fs * 0.05}px)`,
        display: "inline-block",
      }}>
        by
      </span>
      <span style={{ fontSize: fs, fontWeight: 500 }}>
        Thiago&nbsp;Figueiredo
      </span>
      <span style={{
        display: "inline-block",
        marginLeft: fs * 0.06,
        transform: `translateY(-${fs * 0.22}px)`,
      }}>
        <MargAsterisk color={accent} size={fs * 0.42} />
      </span>
    </a>
  );
};

// ---------- Pinboard theme + kit factory ----------

function makePinboardTheme(dark) {
  return {
    dark,
    bg:     dark ? "#14110B" : "#E9E1CE",
    paper:  dark ? "#2A241A" : "#FBF6E8",
    paper2: dark ? "#312A1E" : "#F5EDD6",
    ink:    dark ? "#EFE6D2" : "#161208",
    muted:  dark ? "#958A75" : "#6A5F48",
    faint:  dark ? "#6B634F" : "#9C9178",
    line:   dark ? "#2E2718" : "#CEBFA0",
    accent: dark ? "#FF8240" : "#C14513",
    yt:     "#FF3333",
    marker: "#FFE37A",
    tape:   dark ? "rgba(255, 226, 140, 0.42)" : "rgba(255, 226, 140, 0.75)",
    tape2:  dark ? "rgba(209, 224, 255, 0.36)" : "rgba(200, 220, 255, 0.7)",
    tapeR:  dark ? "rgba(255, 120, 120, 0.40)" : "rgba(255, 150, 150, 0.7)",
    hand:   { fontFamily: '"Caveat", cursive', color: dark ? "#FF8240" : "#C14513" },
    rot: (i) => ((i * 37) % 7 - 3) * 0.5,
    lift: (i) => ((i * 53) % 5 - 2) * 2,
  };
}

function makePinboardKit(theme) {
  const { dark, paper, tape, line } = theme;

  const Tape = ({ color = tape, style = {} }) => (
    <div style={{
      position: "absolute", width: 80, height: 18,
      background: color,
      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.2)",
      ...style,
    }}/>
  );

  const Paper = ({ children, tint = paper, pad = "20px", rotation = 0, y = 0, shadow = true, style = {} }) => (
    <div style={{
      background: tint, padding: pad, position: "relative",
      transform: `rotate(${rotation}deg) translateY(${y}px)`,
      boxShadow: shadow
        ? (dark
          ? "0 2px 0 rgba(0,0,0,0.5), 0 12px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.03)"
          : "0 1px 0 rgba(0,0,0,0.04), 0 8px 20px rgba(70,50,20,0.16), inset 0 0 0 1px rgba(0,0,0,0.03)")
        : "none",
      ...style,
    }}>
      {children}
    </div>
  );

  const L = window._lang;

  const TypeBadge = ({ kind }) => {
    const isVideo = kind === "video";
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 8px",
        background: isVideo ? theme.yt : theme.ink,
        color: "#FFF",
        fontFamily: '"JetBrains Mono", monospace', fontSize: 10,
        letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600,
      }}>
        {isVideo ? (
          <><svg width="9" height="9" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg> {L === "pt" ? "vídeo" : "video"}</>
        ) : (
          <>▤ {L === "pt" ? "texto" : "post"}</>
        )}
      </div>
    );
  };

  const VideoThumb = ({ v, aspect = "16/9", size = "md" }) => (
    <div style={{
      position: "relative", aspectRatio: aspect, overflow: "hidden",
      ...window.postImg({ h: v.thumb.h, h2: v.thumb.h2, pattern: "grid" }, { dark }),
    }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55))" }}/>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          width: size === "lg" ? 68 : 52, height: size === "lg" ? 48 : 36,
          background: theme.yt, borderRadius: size === "lg" ? 14 : 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(255,51,51,0.4)",
        }}>
          <svg width={size === "lg" ? 22 : 16} height={size === "lg" ? 22 : 16} viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
      <div style={{
        position: "absolute", top: 8, left: 8,
        background: theme.yt, color: "#FFF",
        fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
        letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700,
        padding: "3px 7px",
      }}>▶ YouTube</div>
      <div style={{
        position: "absolute", bottom: 8, right: 8,
        background: "rgba(0,0,0,0.85)", color: "#FFF",
        fontFamily: '"JetBrains Mono", monospace', fontSize: 11, padding: "2px 7px",
      }}>{v.duration}</div>
    </div>
  );

  const WritingCard = ({ post, t, index = 0, showTopBadge = false, hrefBase = "#" }) => (
    <div style={{ position: "relative", paddingTop: 16 }}>
      <Paper tint={index % 3 === 1 ? theme.paper2 : theme.paper} pad="0" rotation={theme.rot(index)} y={theme.lift(index)}>
        <Tape
          color={index % 2 ? theme.tape2 : theme.tape}
          style={{ top: -9, [index % 2 ? "left" : "right"]: "28%", transform: `rotate(${(index * 11) % 12 - 6}deg)` }}
        />
        <a href={`${hrefBase}${post.slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <div style={{ position: "relative" }}>
            <PostImg post={post} dark={dark} style={{ aspectRatio: "16/10" }}/>
            <div style={{ position: "absolute", top: 8, left: 8 }}>
              <TypeBadge kind="post"/>
            </div>
          </div>
          <div style={{ padding: "16px 18px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <CatTag cat={post.cat} dark={dark} size="xs"/>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: theme.faint, letterSpacing: "0.08em" }}>
                {post["date_" + L]}
              </span>
            </div>
            <h3 style={{
              fontFamily: '"Fraunces", serif', fontSize: 19, lineHeight: 1.2,
              margin: "6px 0 8px", fontWeight: 500, letterSpacing: "-0.01em",
              color: theme.ink,
            }}>
              {post["title_" + L]}
            </h3>
            <div style={{ fontSize: 12, color: theme.muted, fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.04em" }}>
              {post.read} {t.min_read} · {L === "pt" ? "leitura" : "read"}
            </div>
            {post.tags && post.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                {post.tags.slice(0, 3).map(tag => (
                  <span key={tag} style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
                    color: theme.faint, letterSpacing: "0.04em",
                    padding: "2px 6px", background: "rgba(0,0,0,0.04)",
                  }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </a>
      </Paper>
      {showTopBadge && (
        <div style={{ position: "absolute", top: -4, right: -6, ...theme.hand, fontSize: 18, transform: "rotate(12deg)", color: theme.accent }}>
          ⭐ {L === "pt" ? "top!" : "yess"}
        </div>
      )}
    </div>
  );

  const VideoCard = ({ v, index = 0, aspect = "4/3", hrefBase = "#" }) => (
    <div style={{ position: "relative", paddingTop: 16 }}>
      <Paper tint={theme.paper} pad="12px 12px 18px" rotation={theme.rot(index + 11)} y={theme.lift(index + 11)}>
        <Tape color={theme.tapeR} style={{ top: -9, left: "40%", transform: `rotate(${(index * 7) % 10 - 5}deg)` }}/>
        <a href={`${hrefBase}${v.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <VideoThumb v={v} aspect={aspect}/>
          <div style={{ paddingTop: 14, paddingLeft: 4, paddingRight: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{
                padding: "2px 7px", background: theme.yt, color: "#FFF",
                fontFamily: '"JetBrains Mono", monospace', fontSize: 9,
                letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
              }}>{v["series_" + L]}</span>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: theme.faint, letterSpacing: "0.08em" }}>
                {v["date_" + L]}
              </span>
            </div>
            <h3 style={{
              fontFamily: '"Fraunces", serif', fontSize: 19, lineHeight: 1.2,
              margin: "0 0 8px", fontWeight: 500, letterSpacing: "-0.01em",
              color: theme.ink,
            }}>
              {v["title_" + L]}
            </h3>
            <p style={{ fontSize: 13, color: theme.muted, lineHeight: 1.5, margin: "0 0 10px",
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
              {v["desc_" + L]}
            </p>
            <div style={{ fontSize: 11, color: theme.faint, fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.06em" }}>
              {v.duration} · {v["views_" + L]}
            </div>
            {v.tags && v.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 10 }}>
                {v.tags.slice(0, 3).map(tag => (
                  <span key={tag} style={{
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5,
                    color: theme.faint, letterSpacing: "0.04em",
                    padding: "2px 6px", background: "rgba(0,0,0,0.04)",
                  }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </a>
      </Paper>
    </div>
  );

  // Reusable header for all pages.
  // `nav` is an array of {key, href, label, external?} — the item matching
  // `current` is highlighted with accent underline.
  // `ctas` is any JSX rendered on the right (typically YT + Newsletter buttons).
  const PageHeader = ({ nav, ctas, current = "home" }) => (
    <header style={{ borderBottom: `1px dashed ${theme.line}`, background: theme.bg, position: "sticky", top: 44, zIndex: 5 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <Brand ink={theme.ink} accent={theme.accent} size={22}/>
        </div>
        <nav style={{ display: "flex", gap: 22, fontSize: 14, color: theme.muted, flexWrap: "wrap", alignItems: "center" }}>
          {nav.map(n => {
            const isCurrent = n.key === current;
            return (
              <a key={n.key || n.href} href={n.href}
                target={n.external ? "_blank" : undefined}
                rel={n.external ? "noopener" : undefined}
                style={{
                  color: isCurrent ? theme.ink : theme.muted,
                  textDecoration: "none",
                  fontWeight: isCurrent ? 600 : 400,
                  borderBottom: isCurrent ? `2px solid ${theme.accent}` : "2px solid transparent",
                  paddingBottom: 2,
                  display: "inline-flex", alignItems: "center", gap: 4,
                  transition: "color 0.15s ease, border-color 0.15s ease",
                }}>
                {n.label}{n.external && <span style={{ fontSize: 10, opacity: 0.7 }}>↗</span>}
              </a>
            );
          })}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {ctas}
        </div>
      </div>
    </header>
  );

  // Default CTAs used by most pages: YouTube subscribe (primary channel) + Newsletter.
  // Pages that don't want these can pass their own `ctas` prop.
  const HeaderCTAs = ({ content: C, showYT = true, showNewsletter = true }) => {
    const primaryCh = C.channels && C.channels[0];
    return (
      <>
        {showYT && primaryCh && (
          <a href={primaryCh.url} target="_blank" rel="noopener" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: theme.yt, color: "#FFF", padding: "7px 12px",
            fontSize: 12, fontWeight: 600, textDecoration: "none",
            transform: "rotate(-1deg)",
            boxShadow: "0 2px 0 rgba(0,0,0,0.1)",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#FFF"><path d="M8 5v14l11-7z"/></svg>
            {primaryCh.flag} {L === "pt" ? "Inscrever" : "Subscribe"}
          </a>
        )}
        {showNewsletter && (
          <a href="newsletters.html" style={{
            background: theme.marker, color: "#1A140C", padding: "7px 12px",
            fontSize: 12, fontWeight: 600, textDecoration: "none",
            transform: "rotate(1deg)", display: "inline-block",
            boxShadow: "0 2px 0 rgba(0,0,0,0.1)",
          }}>
            ✉ Newsletter
          </a>
        )}
      </>
    );
  };

  return { Tape, Paper, TypeBadge, VideoThumb, WritingCard, VideoCard, PageHeader, HeaderCTAs };
}

Object.assign(window, {
  PostImg, CatTag, PostMeta, Brand,
  makePinboardTheme, makePinboardKit,
  // Canonical nav shared by every page. Pass t (the i18n bundle) + content.
  // Pages highlight the current item by passing `current` to <PageHeader>.
  buildGlobalNav: function (t, content) {
    const sites = (content && content.sites) || {};
    return [
      { key: "home", href: "Pinboard.html", label: t.nav.home },
      { key: "writing", href: "blog.html", label: t.nav.writing },
      { key: "videos", href: "videos.html", label: t.nav.videos },
      { key: "newsletters", href: "newsletters.html", label: t.nav.newsletter },
      { key: "about", href: "#about", label: t.nav.about },
      sites.contact && {
        key: "contact",
        href: sites.contact.url,
        label: sites.contact["label_" + (t.nav.home === "Home" ? "en" : "pt")] || t.nav.contact,
        external: sites.contact.url && sites.contact.url.startsWith("http"),
      },
      sites.dev && {
        key: "dev",
        href: sites.dev.url,
        label: sites.dev["label_" + (t.nav.home === "Home" ? "en" : "pt")] || t.nav.dev,
        external: true,
      },
    ].filter(Boolean);
  },
});
