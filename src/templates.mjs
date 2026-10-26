// Page templates. Fonts come from Google Fonts; to self-host a licensed face instead,
// put it in src/assets/fonts/, add an @font-face rule to site.css and drop this URL.
const FONTS =
  "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..800;1,6..72,300..800&family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&display=swap";

export const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fmtDate = (d, lang) =>
  d ? d.toLocaleDateString(lang, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";

const isoDate = (d) => (d ? d.toISOString().slice(0, 10) : "");

// Where "home" is from a page `root` levels down, e.g. "../" from an article.
const homeHref = (cfg, root) => (cfg.prettyUrls ? root || "./" : `${root}index.html`);

function head({ cfg, root, title, description, canonical, feed = true, dev }) {
  return `<!doctype html>
<html lang="${esc(cfg.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description || cfg.description)}">
<meta name="color-scheme" content="light dark">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">` : ""}
${feed ? `<link rel="alternate" type="application/rss+xml" title="${esc(cfg.title)}" href="${root}feed.xml">` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${root}assets/site.css">
<script src="${root}assets/site.js" defer></script>
${dev ? `<script>new EventSource("/__reload").onmessage = () => location.reload();</script>` : ""}
</head>`;
}

// Shown on articles: the site name and an explicit link back to the list, both going home.
function siteHeader({ cfg, root }) {
  const home = homeHref(cfg, root);
  return `<header class="site-header">
  <div class="site-header__inner">
    <a class="site-title" href="${home}">${esc(cfg.title)}</a>
    <nav class="site-nav" aria-label="Site"><a href="${home}">All writing</a></nav>
  </div>
</header>`;
}

function siteFooter({ cfg }) {
  return `<footer class="site-footer">
  <div class="site-footer__inner">
    <p>© ${new Date().getUTCFullYear()} ${esc(cfg.author)}</p>
  </div>
</footer>`;
}

export function articlePage({ cfg, post, prev, next, root, link, dev }) {
  const date = post.date ? `<time datetime="${isoDate(post.date)}">${fmtDate(post.date, cfg.language)}</time>` : "";
  const home = homeHref(cfg, root);
  return `${head({ cfg, root, title: `${post.title} – ${cfg.title}`, description: post.description, canonical: cfg.url ? `${cfg.url.replace(/\/$/, "")}/${post.slug}/` : "", dev })}
<body class="page-article">
<a class="skip" href="#content">Skip to the article</a>
${siteHeader({ cfg, root })}
<main id="content">
  <article class="post">
    <header class="post-header">
      ${post.draft ? `<p class="post-flag">Draft, not published</p>` : ""}
      ${post.example ? `<p class="post-flag">Example article, left out of production builds</p>` : ""}
      <h1 class="post-title">${esc(post.title)}</h1>
      ${post.description ? `<p class="standfirst">${esc(post.description)}</p>` : ""}
      <p class="byline"><span class="byline__author">${esc(post.author || cfg.author)}</span>${date ? ` <span class="byline__date">${date}</span>` : ""} <span class="byline__time">${post.minutes} min read</span></p>
    </header>
    <div class="prose">
${post.html}
    </div>
  </article>
  <nav class="post-nav" aria-label="More writing">
    ${next ? `<a class="post-nav__link post-nav__link--newer" href="${link(next)}"><span>Newer</span>${esc(next.title)}</a>` : "<span></span>"}
    ${prev ? `<a class="post-nav__link post-nav__link--older" href="${link(prev)}"><span>Older</span>${esc(prev.title)}</a>` : "<span></span>"}
    <a class="post-nav__home" href="${home}">Back to all writing</a>
  </nav>
</main>
${siteFooter({ cfg })}
</body>
</html>
`;
}

export function indexPage({ cfg, posts, root, link, dev }) {
  const items = posts
    .map(
      (p) => `<li class="post-list__item">
      <a class="post-list__link" href="${link(p)}">
        <h2 class="post-list__title">${esc(p.title)}</h2>
        ${p.description ? `<p class="post-list__dek">${esc(p.description)}</p>` : ""}
        <p class="post-list__meta">${p.date ? `<time datetime="${isoDate(p.date)}">${fmtDate(p.date, cfg.language)}</time>` : ""}<span>${p.minutes} min read</span>${p.draft ? "<span>Draft</span>" : ""}${p.example ? "<span>Example</span>" : ""}</p>
      </a>
    </li>`,
    )
    .join("\n    ");
  const empty = `<div class="empty">
    <p>No articles yet. Add a folder with an <code>index.html</code> to <code>${esc(cfg.contentDir)}/</code>, or run <code>npm run new "My first post"</code>.</p>
  </div>`;
  return `${head({ cfg, root, title: cfg.title, description: cfg.description, canonical: cfg.url || "", dev })}
<body class="page-index">
<a class="skip" href="#content">Skip to the articles</a>
<main id="content" class="home">
  <header class="home-header">
    <h1 class="home-title">${esc(cfg.title)}</h1>
    <p class="home-dek">${esc(cfg.description)}</p>
  </header>
  ${posts.length ? `<ol class="post-list" reversed>\n    ${items}\n  </ol>` : empty}
</main>
${siteFooter({ cfg })}
</body>
</html>
`;
}

export function notFoundPage({ cfg, dev }) {
  return `${head({ cfg, root: "/", title: `Page not found – ${cfg.title}`, feed: false, dev })}
<body class="page-index">
<main id="content" class="home">
  <header class="home-header">
    <h1 class="home-title">Page not found</h1>
    <p class="home-dek">That address doesn't match an article. <a href="/">See all writing</a>.</p>
  </header>
</main>
${siteFooter({ cfg })}
</body>
</html>
`;
}

export function feed({ cfg, posts }) {
  const base = (cfg.url || "").replace(/\/$/, "");
  const items = posts
    .slice(0, 30)
    .map(
      (p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${base}/${p.slug}/</link>
    <guid isPermaLink="true">${base}/${p.slug}/</guid>
    ${p.date ? `<pubDate>${p.date.toUTCString()}</pubDate>` : ""}
    <description>${esc(p.description || "")}</description>
  </item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${esc(cfg.title)}</title>
  <link>${base}/</link>
  <description>${esc(cfg.description)}</description>
  <language>${esc(cfg.language)}</language>
${items}
</channel>
</rss>
`;
}

export function sitemap({ cfg, posts }) {
  const base = (cfg.url || "").replace(/\/$/, "");
  const urls = [`${base}/`, ...posts.map((p) => `${base}/${p.slug}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n")}
</urlset>
`;
}
